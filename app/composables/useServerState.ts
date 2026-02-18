import { reactive, ref } from 'vue';
import type { TabToWorkerMessage, WorkerToTabMessage } from '../types/sse-worker';
import type { ProjectState, SelectionKey, WorkerNotificationEntry } from '../types/worker-state';

type SessionMutatedInfo = Extract<TabToWorkerMessage, { type: 'session.mutated' }>['info'];
type SessionRemovedInfo = Extract<TabToWorkerMessage, { type: 'session.removed' }>;
type ProjectMutatedInfo = Extract<TabToWorkerMessage, { type: 'project.mutated' }>['info'];
type NotificationShowMessage = Extract<WorkerToTabMessage, { type: 'notification.show' }>;
type SendToWorker = (message: TabToWorkerMessage) => boolean;

export function useServerState(initialSender?: SendToWorker) {
  const projects = reactive<Record<string, ProjectState>>({});
  const notifications = reactive<Record<string, WorkerNotificationEntry>>({});
  const bootstrapped = ref(false);

  let sendToWorker: SendToWorker | undefined = initialSender;
  let onNotificationShow: ((message: NotificationShowMessage) => void) | undefined;

  function replaceProjects(next: Record<string, ProjectState>) {
    Object.keys(projects).forEach((key) => {
      delete projects[key];
    });
    Object.assign(projects, next);
  }

  function replaceNotifications(next: Record<string, WorkerNotificationEntry>) {
    Object.keys(notifications).forEach((key) => {
      delete notifications[key];
    });
    Object.assign(notifications, next);
  }

  function handleStateMessage(message: WorkerToTabMessage): boolean {
    if (message.type === 'state.bootstrap') {
      replaceProjects(message.projects);
      replaceNotifications(message.notifications);
      bootstrapped.value = true;
      return true;
    }
    if (message.type === 'state.project-updated') {
      projects[message.projectId] = message.project;
      return true;
    }
    if (message.type === 'state.project-removed') {
      delete projects[message.projectId];
      return true;
    }
    if (message.type === 'state.notifications-updated') {
      replaceNotifications(message.notifications);
      return true;
    }
    if (message.type === 'notification.show') {
      onNotificationShow?.(message);
      return true;
    }
    return false;
  }

  function setWorkerSender(sender?: SendToWorker) {
    sendToWorker = sender;
  }

  function setNotificationShowHandler(handler?: (message: NotificationShowMessage) => void) {
    onNotificationShow = handler;
  }

  function notifySessionMutated(info: SessionMutatedInfo) {
    sendToWorker?.({ type: 'session.mutated', info });
  }

  function notifySessionRemoved(sessionId: string, projectId?: string) {
    const message: SessionRemovedInfo = {
      type: 'session.removed',
      sessionId,
      projectId,
    };
    sendToWorker?.(message);
  }

  function notifyProjectMutated(info: ProjectMutatedInfo) {
    sendToWorker?.({ type: 'project.mutated', info });
  }

  return {
    projects,
    notifications,
    bootstrapped,
    handleStateMessage,
    setWorkerSender,
    setNotificationShowHandler,
    notifySessionMutated,
    notifySessionRemoved,
    notifyProjectMutated,
  };
}

export type UseServerState = ReturnType<typeof useServerState>;
export type { SelectionKey };
