export type SessionKey = {
  projectId: string;
  sessionId: string;
};

export function normalizeSessionKey(projectId: string, sessionId: string): SessionKey | null {
  const normalizedProjectId = projectId.trim();
  const normalizedSessionId = sessionId.trim();
  if (!normalizedProjectId || !normalizedSessionId) return null;
  return {
    projectId: normalizedProjectId,
    sessionId: normalizedSessionId,
  };
}

export function createSessionKey(projectId: string, sessionId: string): string {
  const normalized = normalizeSessionKey(projectId, sessionId);
  if (!normalized) return '';
  return `${normalized.projectId}\u0000${normalized.sessionId}`;
}

export function parseSessionKey(key: string): SessionKey | null {
  const separatorIndex = key.indexOf('\u0000');
  if (separatorIndex <= 0) return null;
  const projectId = key.slice(0, separatorIndex);
  const sessionId = key.slice(separatorIndex + 1);
  return normalizeSessionKey(projectId, sessionId);
}
