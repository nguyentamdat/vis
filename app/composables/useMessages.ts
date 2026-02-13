import { computed, onUnmounted, readonly, shallowReactive } from 'vue';
import type {
  Message,
  MessageAttachment,
  MessageDiffEntry,
  MessageStatus,
  MessageUsage,
} from '../types/message';

const SAFETY_NET_INTERVAL_MS = 30_000;

type MessageScope = {
  on(event: string, listener: (payload: unknown) => void): () => void;
};

type UseMessagesOptions = {
  getAllowedSessionIds?: () => Set<string>;
};

type MessageShape = Partial<Message> & {
  id?: string;
  messageId?: string;
  partId?: string;
  partType?: string;
  sessionId?: string;
  sessionID?: string;
  parentID?: string;
  isPartUpdatedEvent?: boolean;
  bodyContent?: string;
};

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asRole(value: unknown): Message['role'] | undefined {
  return value === 'user' || value === 'assistant' ? value : undefined;
}

function asStatus(value: unknown): MessageStatus | undefined {
  return value === 'streaming' || value === 'complete' || value === 'error' ? value : undefined;
}

function normalizeUsage(value: unknown): MessageUsage | undefined {
  const rec = toRecord(value);
  const tokens = toRecord(rec?.tokens);
  if (!tokens) return undefined;
  const input = asNumber(tokens.input);
  const output = asNumber(tokens.output);
  const reasoning = asNumber(tokens.reasoning);
  if (input === undefined || output === undefined || reasoning === undefined) return undefined;
  const cacheRec = toRecord(tokens.cache);
  const cacheRead = asNumber(cacheRec?.read);
  const cacheWrite = asNumber(cacheRec?.write);
  return {
    tokens: {
      input,
      output,
      reasoning,
      cache:
        cacheRead === undefined || cacheWrite === undefined
          ? undefined
          : { read: cacheRead, write: cacheWrite },
    },
    cost: asNumber(rec?.cost),
    providerId: asString(rec?.providerId),
    modelId: asString(rec?.modelId),
    contextPercent:
      rec?.contextPercent === null ? null : (asNumber(rec?.contextPercent) ?? undefined),
  };
}

function normalizeAttachments(value: unknown): MessageAttachment[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const result: MessageAttachment[] = [];
  for (let index = 0; index < value.length; index++) {
    const rec = toRecord(value[index]);
    if (!rec) continue;
    const url = asString(rec.url);
    if (!url) continue;
    const id = asString(rec.id) ?? `attachment:${index}:${url}`;
    const mime = asString(rec.mime) ?? asString(rec.mediaType) ?? 'application/octet-stream';
    const filename = asString(rec.filename) ?? asString(rec.name) ?? `attachment-${index + 1}`;
    result.push({ id, url, mime, filename });
  }
  return result.length > 0 ? result : undefined;
}

function normalizeDiffs(value: unknown): MessageDiffEntry[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const result: MessageDiffEntry[] = [];
  for (const item of value) {
    const rec = toRecord(item);
    if (!rec) continue;
    const file = asString(rec.file) ?? asString(rec.path);
    if (!file) continue;
    result.push({
      file,
      diff: asString(rec.diff) ?? '',
      before: asString(rec.before),
      after: asString(rec.after),
    });
  }
  return result.length > 0 ? result : undefined;
}

function byTimeThenId(a: Message, b: Message): number {
  const aTime = a.time ?? 0;
  const bTime = b.time ?? 0;
  if (aTime !== bTime) return aTime - bTime;
  return a.id.localeCompare(b.id);
}

export function useMessages(scope: MessageScope, options: UseMessagesOptions = {}) {
  const messages = shallowReactive(new Map<string, Message>());
  const messagePartsById = new Map<string, Map<string, string>>();
  const messagePartOrderById = new Map<string, string[]>();

  function get(id: string): Message | undefined {
    return messages.get(id);
  }

  function setMessage(id: string, updates: Partial<Message>) {
    const existing = messages.get(id);
    if (existing) {
      messages.set(id, { ...existing, ...updates, id });
      return;
    }
    const role = updates.role ?? 'assistant';
    const sessionId = updates.sessionId;
    if (!sessionId) return;
    messages.set(id, {
      id,
      sessionId,
      role,
      content: updates.content ?? '',
      status: updates.status ?? 'streaming',
      parentId: updates.parentId,
      agent: updates.agent,
      model: updates.model,
      providerId: updates.providerId,
      modelId: updates.modelId,
      variant: updates.variant,
      time: updates.time,
      usage: updates.usage,
      attachments: updates.attachments,
      diffs: updates.diffs,
      error: updates.error ?? null,
      classification: updates.classification,
    });
  }

  function resolveStreamingContent(id: string, partId: string, content: string): string {
    const parts = messagePartsById.get(id) ?? new Map<string, string>();
    parts.set(partId, content);
    messagePartsById.set(id, parts);
    const order = messagePartOrderById.get(id) ?? [];
    if (!order.includes(partId)) order.push(partId);
    messagePartOrderById.set(id, order);
    return order.map((key) => parts.get(key) ?? '').join('');
  }

  function parseMessagePayload(
    payload: unknown,
  ): { sessionId?: string; message: MessageShape } | null {
    const rec = toRecord(payload);
    if (!rec) return null;
    const nested = toRecord(rec.message);
    const message = (nested ?? rec) as MessageShape;
    const sessionId = asString(rec.sessionId) ?? asString(rec.sessionID) ?? message.sessionId;
    return { sessionId, message };
  }

  function handleMessageContent(payload: unknown) {
    const parsed = parseMessagePayload(payload);
    if (!parsed) return;
    const sessionId = parsed.sessionId ?? parsed.message.sessionId ?? parsed.message.sessionID;
    const id = parsed.message.id ?? parsed.message.messageId;
    if (!sessionId || !id) return;

    const message = parsed.message;
    const partId = asString(message.partId);
    const rawContent = typeof message.content === 'string' ? message.content : '';
    const content =
      partId && rawContent.length > 0
        ? resolveStreamingContent(id, partId, rawContent)
        : rawContent;

    setMessage(id, {
      sessionId,
      parentId: asString(message.parentId) ?? asString(message.parentID),
      role:
        asRole(message.role) ??
        (asString(message.parentId ?? message.parentID) ? 'assistant' : 'user'),
      content,
      status: asStatus(message.status) ?? 'streaming',
      agent: asString(message.agent),
      model: asString(message.model),
      providerId: asString(message.providerId),
      modelId: asString(message.modelId),
      variant: asString(message.variant),
      time: asNumber(message.time),
      error:
        message.error && typeof message.error === 'object'
          ? {
              name: asString((message.error as Record<string, unknown>).name) ?? 'Error',
              message: asString((message.error as Record<string, unknown>).message) ?? '',
            }
          : null,
      classification:
        message.classification === 'real_user' ||
        message.classification === 'system_injection' ||
        message.classification === 'unknown'
          ? message.classification
          : undefined,
    });
  }

  function handleMessageFinish(payload: unknown) {
    const rec = toRecord(payload);
    if (!rec) return;
    const id = asString(rec.messageId);
    if (!id) return;
    const finish = asString(rec.finish);
    const status: MessageStatus = finish === 'error' || rec.error ? 'error' : 'complete';
    const errorRec = toRecord(rec.error);
    setMessage(id, {
      sessionId: asString(rec.sessionId) ?? asString(rec.sessionID),
      parentId: asString(rec.parentId) ?? asString(rec.parentID),
      status,
      error:
        status === 'error'
          ? {
              name: asString(errorRec?.name) ?? 'Error',
              message: asString(errorRec?.message) ?? '',
            }
          : null,
    });
  }

  function handleMessageUsage(payload: unknown) {
    const rec = toRecord(payload);
    if (!rec) return;
    const id = asString(rec.messageId);
    if (!id) return;
    const usage = normalizeUsage(rec.usage);
    if (!usage) return;
    setMessage(id, {
      sessionId: asString(rec.sessionId) ?? asString(rec.sessionID),
      usage,
    });
  }

  function handleMessageAttachments(payload: unknown) {
    const rec = toRecord(payload);
    if (!rec) return;
    const id = asString(rec.messageId);
    if (!id) return;
    const attachments = normalizeAttachments(rec.attachments);
    setMessage(id, {
      sessionId: asString(rec.sessionId) ?? asString(rec.sessionID),
      attachments,
    });
  }

  function handleMessageDiffs(payload: unknown) {
    const rec = toRecord(payload);
    if (!rec) return;
    const id = asString(rec.messageId);
    if (!id) return;
    const diffs = normalizeDiffs(rec.diffs);
    setMessage(id, {
      sessionId: asString(rec.sessionId) ?? asString(rec.sessionID),
      diffs,
    });
  }

  function getChildren(parentId: string): Message[] {
    return [...messages.values()].filter((msg) => msg.parentId === parentId).sort(byTimeThenId);
  }

  function getThread(rootId: string): Message[] {
    const root = messages.get(rootId);
    if (!root) return [];
    const result: Message[] = [];
    const queue: string[] = [rootId];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      const message = messages.get(current);
      if (!message) continue;
      result.push(message);
      const children = getChildren(current);
      for (const child of children) queue.push(child.id);
    }
    return result.sort(byTimeThenId);
  }

  function getFinalAnswer(rootId: string): Message | undefined {
    const thread = getThread(rootId);
    const assistants = thread.filter((msg) => msg.role === 'assistant').sort(byTimeThenId);
    return assistants[assistants.length - 1];
  }

  function loadHistory(entries: unknown[]) {
    for (const entry of entries) {
      const rec = toRecord(entry);
      if (!rec) continue;
      const id = asString(rec.id);
      const sessionId = asString(rec.sessionId) ?? asString(rec.sessionID);
      if (!id || !sessionId) continue;
      setMessage(id, {
        sessionId,
        parentId: asString(rec.parentId) ?? asString(rec.parentID),
        role: asRole(rec.role) ?? 'assistant',
        content: asString(rec.content) ?? asString(rec.text) ?? '',
        status: asStatus(rec.status) ?? 'complete',
        time: asNumber(rec.time) ?? asNumber(rec.messageTime),
        usage: normalizeUsage(rec.usage),
        attachments: normalizeAttachments(rec.attachments),
        diffs: normalizeDiffs(rec.diffs),
      });
    }
  }

  function reset() {
    messages.clear();
    messagePartsById.clear();
    messagePartOrderById.clear();
  }

  function runSafetyNetGc() {
    const allowedSessionIds = options.getAllowedSessionIds?.();
    if (!allowedSessionIds || allowedSessionIds.size === 0) return;
    for (const [id, message] of messages.entries()) {
      if (allowedSessionIds.has(message.sessionId)) continue;
      messages.delete(id);
      messagePartsById.delete(id);
      messagePartOrderById.delete(id);
    }
  }

  const unsubscribers = [
    scope.on('message:content', handleMessageContent),
    scope.on('message:finish', handleMessageFinish),
    scope.on('message:usage', handleMessageUsage),
    scope.on('message:attachments', handleMessageAttachments),
    scope.on('message:diffs', handleMessageDiffs),
    scope.on('message:parsed', handleMessageContent),
  ];

  const gcTimer = setInterval(runSafetyNetGc, SAFETY_NET_INTERVAL_MS);

  function dispose() {
    for (const unsubscribe of unsubscribers) unsubscribe();
    clearInterval(gcTimer);
  }

  onUnmounted(dispose);

  const roots = computed(() => {
    return [...messages.values()].filter((msg) => !msg.parentId).sort(byTimeThenId);
  });

  const streaming = computed(() => {
    return [...messages.values()].filter((msg) => msg.status === 'streaming').sort(byTimeThenId);
  });

  return {
    messages: readonly(messages),
    roots,
    getChildren,
    getThread,
    getFinalAnswer,
    get,
    streaming,
    loadHistory,
    reset,
    dispose,
  };
}
