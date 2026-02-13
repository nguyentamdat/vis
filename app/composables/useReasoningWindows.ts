import { nextTick, onUnmounted, type Ref } from 'vue';
import type { MessagePartUpdatedPacket, MessageUpdatedPacket } from '../types/sse';
import type { SessionScope } from './useGlobalEvents';
import { renderWorkerHtml } from '../utils/workerRenderer';

export type ReasoningFinish = {
  id: string;
  time: number;
};

type FileReadEntry = {
  messageKey?: string;
  follow?: boolean;
  isReasoning?: boolean;
  sessionId?: string;
  expiresAt: number;
  content?: string;
  html?: string;
  x?: number;
  y?: number;
  [key: string]: unknown;
};

export function useReasoningWindows(options: {
  scope?: SessionScope;
  selectedSessionId: Ref<string>;
  queue: Ref<FileReadEntry[]>;
  toolWindowCanvasEl: Ref<HTMLDivElement | null>;
  reasoningCloseDelayMs: number;
}) {
  const { selectedSessionId, queue, toolWindowCanvasEl, reasoningCloseDelayMs } = options;
  let boundScope = options.scope;

  const reasoningTitleBySessionId = new Map<string, string>();
  const reasoningCloseTimers = new Map<string, number>();
  const lastReasoningMessageIdByKey = new Map<string, string>();
  const activeReasoningMessageIdByKey = new Map<string, string>();
  const finishedReasoningByKey = new Map<string, ReasoningFinish>();

  function getReasoningKey(sessionId?: string) {
    return sessionId ?? selectedSessionId.value ?? 'main';
  }

  function getMessageKey(messageId: string, sessionId?: string) {
    return `${sessionId || 'main'}:${messageId}`;
  }

  function getReasoningFinish(reasoningKey: string, messageId?: string) {
    const finished = finishedReasoningByKey.get(reasoningKey);
    if (!finished) return null;
    if (messageId && finished.id !== messageId) return null;
    const activeId = activeReasoningMessageIdByKey.get(reasoningKey);
    if (activeId && finished.id !== activeId) return null;
    return finished;
  }

  function markReasoningFinished(sessionId?: string, messageId?: string) {
    const resolvedSessionId = sessionId ?? selectedSessionId.value;
    const reasoningKey = getReasoningKey(resolvedSessionId);
    const activeId = activeReasoningMessageIdByKey.get(reasoningKey);
    const resolvedMessageId = messageId ?? activeId;
    if (!resolvedMessageId) return false;
    if (activeId && resolvedMessageId !== activeId) return false;
    finishedReasoningByKey.set(reasoningKey, { id: resolvedMessageId, time: Date.now() });
    return true;
  }

  function clearReasoningCloseTimer(reasoningKey: string) {
    const existing = reasoningCloseTimers.get(reasoningKey);
    if (existing === undefined) return;
    window.clearTimeout(existing);
    reasoningCloseTimers.delete(reasoningKey);
  }

  function clearReasoningCloseTimerForSession(sessionId?: string) {
    clearReasoningCloseTimer(getReasoningKey(sessionId));
  }

  function updateReasoningExpiry(sessionId: string | undefined, status: 'busy' | 'idle') {
    if (!sessionId && !selectedSessionId.value) return;
    const targetSessionId = sessionId ?? selectedSessionId.value;
    if (!targetSessionId) return;
    const reasoningKey = getReasoningKey(targetSessionId);
    const finish = getReasoningFinish(reasoningKey);
    const isFinished = Boolean(finish);
    if (status === 'idle' && !isFinished) return;
    if (status === 'busy' && isFinished) return;
    const now = Date.now();
    const nextExpiresAt =
      status === 'busy'
        ? Number.MAX_SAFE_INTEGER
        : finish
          ? finish.time + reasoningCloseDelayMs
          : now;
    queue.value.forEach((entry) => {
      if (!entry.isReasoning) return;
      const matchesSession =
        entry.sessionId === targetSessionId ||
        (!entry.sessionId && targetSessionId === selectedSessionId.value);
      if (!matchesSession) return;
      entry.expiresAt = nextExpiresAt;
    });
  }

  function scheduleReasoningClose(sessionId?: string) {
    const resolvedSessionId = sessionId ?? selectedSessionId.value;
    const reasoningKey = getReasoningKey(resolvedSessionId);
    clearReasoningCloseTimer(reasoningKey);
    if (!resolvedSessionId) return;
    const timer = window.setTimeout(() => {
      reasoningCloseTimers.delete(reasoningKey);
      updateReasoningExpiry(resolvedSessionId, 'idle');
    }, reasoningCloseDelayMs);
    reasoningCloseTimers.set(reasoningKey, timer);
  }

  function scheduleReasoningScroll(messageKey: string) {
    nextTick(() => {
      requestAnimationFrame(() => {
        const canvas = toolWindowCanvasEl.value;
        if (!canvas) return;
        const entry = queue.value.find((item) => item.messageKey === messageKey);
        if (entry && entry.follow === false) return;
        if (entry) entry.follow = true;
        const term = canvas.querySelector(
          `[data-message-key="${messageKey}"] .term-inner`,
        ) as HTMLElement | null;
        if (!term) return;
        term.scrollTop = Math.max(0, term.scrollHeight - term.clientHeight);
      });
    });
  }

  function reset() {
    reasoningTitleBySessionId.clear();
    reasoningCloseTimers.clear();
    lastReasoningMessageIdByKey.clear();
    activeReasoningMessageIdByKey.clear();
    finishedReasoningByKey.clear();
  }

  // ── SSE event subscriptions ───────────────────────────────────────────────

  const unsubs: Array<() => void> = [];

  function subscribe(scope: SessionScope) {
    unsubs.forEach((fn) => fn());
    unsubs.length = 0;
    boundScope = scope;

    unsubs.push(
      scope.on('message.part.updated', (packet: MessagePartUpdatedPacket) => {
        if (packet.part.type !== 'reasoning') return;

        const part = packet.part;
        const resolvedSessionId = part.sessionID || selectedSessionId.value;
        const reasoningKey = getReasoningKey(resolvedSessionId);
        const messageId = part.messageID;

        clearReasoningCloseTimerForSession(resolvedSessionId);

        if (part.text) {
          const firstLine = part.text.split('\n')[0]?.trim();
          if (firstLine) {
            reasoningTitleBySessionId.set(resolvedSessionId, firstLine);
          }
        }

        activeReasoningMessageIdByKey.set(reasoningKey, messageId);
        lastReasoningMessageIdByKey.set(reasoningKey, messageId);

        const messageKey = getMessageKey(messageId, resolvedSessionId);
        let entry = queue.value.find((e) => e.messageKey === messageKey);

        if (!entry) {
          const { x, y } = (() => {
            const el = toolWindowCanvasEl.value;
            const w = el?.clientWidth || window.innerWidth;
            const h = el?.clientHeight || window.innerHeight;
            const targetW = 600;
            const targetH = 400;
            const maxX = Math.max(0, w - targetW - 20);
            const maxY = Math.max(0, h - targetH - 20);
            return {
              x: 20 + Math.floor(Math.random() * maxX),
              y: 20 + Math.floor(Math.random() * maxY),
            };
          })();

          entry = {
            messageKey,
            sessionId: resolvedSessionId,
            isReasoning: true,
            expiresAt: Number.MAX_SAFE_INTEGER,
            content: part.text || '',
            html: '',
            time: Date.now(),
            follow: true,
            x,
            y,
          };
          queue.value.push(entry);
        } else {
          entry.content = part.text || '';
        }

        if (entry.content) {
          renderWorkerHtml({
            id: `reasoning-${messageId}`,
            code: entry.content,
            lang: 'markdown',
            theme: 'dark-plus',
          }).then((html) => {
            if (entry) entry.html = html;
          });
        }

        if (part.time?.end) {
          markReasoningFinished(resolvedSessionId, messageId);
          scheduleReasoningClose(resolvedSessionId);
        }
      }),
    );

    unsubs.push(
      scope.on('message.updated', (packet: MessageUpdatedPacket) => {
        if (packet.info.role !== 'assistant') return;

        const resolvedSessionId = packet.info.sessionID || selectedSessionId.value;
        const messageId = packet.info.id;

        if (packet.info.time.completed || packet.info.error) {
          markReasoningFinished(resolvedSessionId, messageId);
          scheduleReasoningClose(resolvedSessionId);
        }
      }),
    );
  }

  if (boundScope) subscribe(boundScope);

  onUnmounted(() => {
    unsubs.forEach((fn) => fn());
    unsubs.length = 0;
  });

  return {
    reasoningTitleBySessionId,
    reasoningCloseTimers,
    lastReasoningMessageIdByKey,
    activeReasoningMessageIdByKey,
    finishedReasoningByKey,
    getReasoningKey,
    getReasoningFinish,
    markReasoningFinished,
    clearReasoningCloseTimer,
    clearReasoningCloseTimerForSession,
    updateReasoningExpiry,
    scheduleReasoningClose,
    scheduleReasoningScroll,
    reset,
    bindScope: subscribe,
  };
}

export type UseReasoningWindowsReturn = ReturnType<typeof useReasoningWindows>;
