/**
 * Direct-mode state handler for browsers without SharedWorker support.
 *
 * Mirrors the notification and project state management logic from
 * sse-shared-worker.ts, running in the main thread instead of a worker.
 * Generates the same WorkerToTabMessage events so the rest of the app
 * (useServerState, App.vue) works identically.
 */
import type { SsePacket } from '../types/sse';
import type { WorkerToTabMessage } from '../types/sse-worker';
import { createNotificationManager } from './notificationManager';
import {
  getCurrentProject,
  getSessionStatusMap,
  getVcsInfo,
  listProjects,
  listSessions,
  setAuthorization,
  setBaseUrl,
} from './opencode';
import { createStateBuilder } from './stateBuilder';

type Emit = (message: WorkerToTabMessage) => void;

function normalizeDirectory(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const normalized = trimmed.replace(/\/+$/, '');
  return normalized || '/';
}

function asObjectArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value as T[];
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (typeof item !== 'string') return null;
  }
  return value as string[];
}

function asStatusMap(value: unknown): Record<string, { type?: string }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, { type?: string }>;
}

export function createDirectModeState(emit: Emit) {
  const stateBuilder = createStateBuilder();
  const notificationManager = createNotificationManager((projectId, sessionId) => ({
    projectId,
    sessionId: stateBuilder.resolveRootSessionIdForProject(projectId, sessionId),
  }));

  let activeSelection: { projectId: string; sessionId: string } | null = null;

  function emitProjectUpdated(projectId: string | null) {
    if (!projectId) return;
    const project = stateBuilder.getProject(projectId);
    if (!project) return;
    emit({ type: 'state.project-updated', projectId, project });
  }

  function emitNotificationsUpdated() {
    emit({
      type: 'state.notifications-updated',
      notifications: notificationManager.getState(),
    });
  }

  function emitNotificationShow(
    projectId: string,
    sessionId: string,
    kind: 'permission' | 'question' | 'idle',
  ) {
    if (!projectId || !sessionId) return;
    emit({ type: 'notification.show', projectId, sessionId, kind });
  }


  async function bootstrap(baseUrl: string, authorization?: string): Promise<void> {
    setBaseUrl(baseUrl);
    setAuthorization(authorization);

    const projects = asObjectArray<Record<string, unknown>>(await listProjects());
    const directories = new Set<string>(['']);

    stateBuilder.applyProjects(projects as Parameters<typeof stateBuilder.applyProjects>[0]);

    projects.forEach((project) => {
      const worktree = normalizeDirectory(
        typeof project.worktree === 'string' ? project.worktree : '',
      );
      if (worktree) directories.add(worktree);

      const sandboxes = asStringArray(project.sandboxes) ?? [];
      sandboxes.forEach((sandbox) => {
        const dir = normalizeDirectory(sandbox);
        if (dir) directories.add(dir);
      });
    });

    await Promise.all(
      Array.from(directories).map(async (directory) => {
        const [sessions, statuses] = await Promise.all([
          listSessions({ directory, roots: true }),
          getSessionStatusMap(directory),
        ]);
        stateBuilder.applySessions(
          asObjectArray(sessions) as Parameters<typeof stateBuilder.applySessions>[0],
        );
        stateBuilder.applyStatuses(asStatusMap(statuses));
      }),
    );

    await Promise.all(
      Array.from(directories).map(async (directory) => {
        const raw = await getVcsInfo(directory).catch(() => null);
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
        const vcsInfo = raw as Record<string, unknown>;
        const branch = typeof vcsInfo.branch === 'string' ? vcsInfo.branch : undefined;
        if (!branch) return;
        stateBuilder.applyVcsInfo(directory, { branch });
      }),
    );

    stateBuilder.getDefaultProjectId();

    emit({
      type: 'state.bootstrap',
      projects: stateBuilder.getState().projects,
      notifications: notificationManager.getState(),
    });
  }

  /**
   * Resolve an unknown session directory by fetching the project info.
   * Mirrors sse-shared-worker.ts resolveUnknownSessionDirectory.
   */
  async function resolveUnknownSessionDirectory(info: Record<string, unknown>) {
    const directory = normalizeDirectory(typeof info.directory === 'string' ? info.directory : '');
    if (!directory) return;

    const raw = await getCurrentProject(directory).catch(() => null);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const projectInfo = raw as Record<string, unknown>;
    if (!projectInfo.id || !projectInfo.worktree) return;

    const worktree = normalizeDirectory(
      typeof projectInfo.worktree === 'string' ? projectInfo.worktree : '',
    );
    if (!worktree) return;

    const knownProjectId = stateBuilder.resolveProjectIdForDirectory(worktree);
    if (knownProjectId) {
      const changedProjectId = stateBuilder.registerSandboxDirectory(knownProjectId, directory);
      emitProjectUpdated(changedProjectId);
      const changedSessionProjectId = stateBuilder.applySessionMutated(
        info as Parameters<typeof stateBuilder.applySessionMutated>[0],
      );
      emitProjectUpdated(changedSessionProjectId);
      return;
    }

    if (directory !== worktree) return;

    const changedProjectId = stateBuilder.processProjectUpdated(
      projectInfo as Parameters<typeof stateBuilder.processProjectUpdated>[0],
    );
    emitProjectUpdated(changedProjectId);
    const changedSessionProjectId = stateBuilder.applySessionMutated(
      info as Parameters<typeof stateBuilder.applySessionMutated>[0],
    );
    emitProjectUpdated(changedSessionProjectId);
  }

  function handlePacket(packet: SsePacket) {
    const packetType = packet.payload.type;
    const properties = packet.payload.properties;
    const packetDirectory = normalizeDirectory(packet.directory);
    let projectId: string | null = null;
    let notificationsChanged = false;

    switch (packetType) {
      case 'session.created': {
        const info = properties?.info as Record<string, unknown> | undefined;
        if (!info) break;
        projectId = stateBuilder.processSessionCreated(
          info as Parameters<typeof stateBuilder.processSessionCreated>[0],
        );
        if (!projectId) void resolveUnknownSessionDirectory(info);
        break;
      }
      case 'session.updated': {
        const info = properties?.info as Record<string, unknown> | undefined;
        if (!info) break;
        projectId = stateBuilder.processSessionUpdated(
          info as Parameters<typeof stateBuilder.processSessionUpdated>[0],
        );
        if (!projectId) void resolveUnknownSessionDirectory(info);
        break;
      }
      case 'session.deleted': {
        const info = properties?.info as Record<string, unknown> | undefined;
        if (!info) break;
        const sessionId = info.id as string;
        const deletedDirectory = normalizeDirectory(
          typeof info.directory === 'string' ? info.directory : '',
        );
        const deletedProjectId = stateBuilder.resolveProjectIdForDirectory(deletedDirectory);
        projectId = stateBuilder.processSessionDeleted(sessionId, deletedProjectId);
        if (deletedProjectId) {
          const cleared = notificationManager.clearSession(deletedProjectId, sessionId);
          notificationsChanged = cleared || notificationsChanged;
        }
        break;
      }
      case 'session.status': {
        const sessionId = properties?.sessionID as string | undefined;
        const status = properties?.status as Record<string, unknown> | undefined;
        const statusType = status?.type as string | undefined;
        if (!sessionId || !statusType) break;
        const statusProjectId = stateBuilder.resolveProjectIdForDirectory(packetDirectory);
        if (statusProjectId) {
          projectId = stateBuilder.processSessionStatus(sessionId, statusType, statusProjectId);
          const rootSessionId = stateBuilder.resolveRootSessionIdForProject(
            statusProjectId,
            sessionId,
          );
          if (rootSessionId) {
            const idleRequestId = `idle:${statusProjectId}:${rootSessionId}`;
            const treeIdle = stateBuilder.isSessionTreeIdle(statusProjectId, rootSessionId);
            if (!treeIdle) {
              notificationsChanged =
                notificationManager.removeNotification(idleRequestId) || notificationsChanged;
            } else {
              const added = notificationManager.addNotification(
                statusProjectId,
                rootSessionId,
                idleRequestId,
              );
              notificationsChanged = added || notificationsChanged;
              if (added) emitNotificationShow(statusProjectId, rootSessionId, 'idle');
            }
          }
        }
        break;
      }
      case 'project.updated': {
        projectId = stateBuilder.processProjectUpdated(
          properties as Parameters<typeof stateBuilder.processProjectUpdated>[0],
        );
        break;
      }
      case 'vcs.branch.updated': {
        const branch = (properties?.branch as string) ?? '';
        projectId = stateBuilder.processVcsBranchUpdated(packetDirectory, branch);
        break;
      }
      case 'permission.asked': {
        const requestProjectId = stateBuilder.resolveProjectIdForDirectory(packetDirectory);
        const requestId = properties?.id as string | undefined;
        const requestSessionId = properties?.sessionID as string | undefined;
        if (requestProjectId && requestId && requestSessionId) {
          const added = notificationManager.addNotification(
            requestProjectId,
            requestSessionId,
            requestId,
          );
          notificationsChanged = added || notificationsChanged;
          if (added) emitNotificationShow(requestProjectId, requestSessionId, 'permission');
        }
        break;
      }
      case 'question.asked': {
        const requestProjectId = stateBuilder.resolveProjectIdForDirectory(packetDirectory);
        const requestId = properties?.id as string | undefined;
        const requestSessionId = properties?.sessionID as string | undefined;
        if (requestProjectId && requestId && requestSessionId) {
          const added = notificationManager.addNotification(
            requestProjectId,
            requestSessionId,
            requestId,
          );
          notificationsChanged = added || notificationsChanged;
          if (added) emitNotificationShow(requestProjectId, requestSessionId, 'question');
        }
        break;
      }
      case 'permission.replied':
      case 'question.replied':
      case 'question.rejected': {
        const requestId = properties?.requestID as string | undefined;
        if (requestId) {
          notificationsChanged =
            notificationManager.removeNotification(requestId) || notificationsChanged;
        }
        break;
      }
      case 'worktree.ready': {
        const readyBranch = properties?.branch as string | undefined;
        if (typeof readyBranch === 'string') {
          projectId =
            stateBuilder.processVcsBranchUpdated(packetDirectory, readyBranch) || projectId;
        }
        break;
      }
    }

    emitProjectUpdated(projectId);
    if (notificationsChanged) emitNotificationsUpdated();
  }

  function setActiveSelection(projectId: string, sessionId: string) {
    if (!projectId || !sessionId) {
      activeSelection = null;
      return;
    }
    activeSelection = { projectId, sessionId };
    const rootSessionId = stateBuilder.resolveRootSessionIdForProject(projectId, sessionId);
    const idleRequestId = `idle:${projectId}:${rootSessionId || sessionId}`;
    if (notificationManager.removeNotification(idleRequestId)) {
      emitNotificationsUpdated();
    }
  }

  function loadSessions(directory: string) {
    const normalizedDir = normalizeDirectory(directory);
    if (!normalizedDir) return;

    void (async () => {
      const [rawSessions, rawStatuses] = await Promise.all([
        listSessions({ directory: normalizedDir, roots: true }),
        getSessionStatusMap(normalizedDir),
      ]);
      const sessions = asObjectArray(rawSessions) as Parameters<
        typeof stateBuilder.applySessions
      >[0];
      stateBuilder.applySessions(sessions);
      stateBuilder.applyStatuses(asStatusMap(rawStatuses));

      const projectIds = new Set<string>();
      for (const session of sessions) {
        const pid = (session as Record<string, unknown>).projectID;
        if (typeof pid === 'string' && pid.trim()) projectIds.add(pid.trim());
      }
      for (const pid of projectIds) emitProjectUpdated(pid);
    })().catch(() => {});
  }

  return { bootstrap, handlePacket, setActiveSelection, loadSessions };
}
