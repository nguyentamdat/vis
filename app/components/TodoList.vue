<template>
  <div class="todo-body">
    <div class="todo-header">
      <div class="todo-title">TODO</div>
      <div class="todo-count">{{ displayTotalCount }}</div>
    </div>
    <div v-if="displaySessions.length === 0" class="todo-empty">No todos yet.</div>
    <div v-else class="todo-groups">
      <section v-for="session in displaySessions" :key="session.sessionId" class="todo-group">
        <header class="todo-group-header">
          <span class="todo-group-title">{{ session.title }}</span>
          <span v-if="session.isSubagent" class="todo-badge">subagent</span>
        </header>
        <div v-if="session.error" class="todo-error">{{ session.error }}</div>
        <TransitionGroup v-else appear name="fade" tag="ul" class="todo-list">
          <li
            v-for="todo in session.todos"
            :key="todo.id"
            class="todo-item"
            :class="[{ 'is-leaving': todo.leaving }, `is-${todo.status}`]"
          >
            <span class="todo-status" :title="todo.status">{{ statusIcon(todo.status) }}</span>
            <span class="todo-text">{{ todo.content }}</span>
            <span class="todo-priority" :class="`is-${todo.priority}`">{{ todo.priority }}</span>
          </li>
        </TransitionGroup>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

type TodoEntry = {
  id: string;
  content: string;
  status: string;
  priority: string;
};

type TodoSession = {
  sessionId: string;
  title: string;
  isSubagent: boolean;
  todos: TodoEntry[];
  loading: boolean;
  error?: string;
};

type DisplayTodo = TodoEntry & {
  leaving?: boolean;
};

type DisplaySession = Omit<TodoSession, 'todos'> & {
  todos: DisplayTodo[];
};

const TODO_REMOVE_DELAY_MS = 2000;

const props = defineProps<{
  sessions: TodoSession[];
}>();

const displaySessions = ref<DisplaySession[]>([]);
const removeTimers = new Map<string, number>();

const displayTotalCount = computed(() =>
  displaySessions.value.reduce((sum, session) => sum + session.todos.length, 0),
);

function timerKey(sessionId: string, todoId: string) {
  return `${sessionId}:${todoId}`;
}

function clearRemoveTimer(key: string) {
  const timer = removeTimers.get(key);
  if (timer === undefined) return;
  window.clearTimeout(timer);
  removeTimers.delete(key);
}

function pruneEmptySessions() {
  displaySessions.value = displaySessions.value.filter(
    (session) => session.todos.length > 0 || Boolean(session.error),
  );
}

function removeTodoAfterDelay(sessionId: string, todoId: string) {
  const key = timerKey(sessionId, todoId);
  if (removeTimers.has(key)) return;
  const timer = window.setTimeout(() => {
    removeTimers.delete(key);
    displaySessions.value = displaySessions.value
      .map((session) => {
        if (session.sessionId !== sessionId) return session;
        return {
          ...session,
          todos: session.todos.filter((todo) => todo.id !== todoId),
        };
      })
      .filter((session) => session.todos.length > 0 || Boolean(session.error));
    pruneEmptySessions();
  }, TODO_REMOVE_DELAY_MS);
  removeTimers.set(key, timer);
}

watch(
  () => props.sessions,
  (incoming) => {
    const incomingBySessionId = new Map(incoming.map((session) => [session.sessionId, session]));
    const nextDisplay = displaySessions.value.map((displaySession) => {
      const nextSession = incomingBySessionId.get(displaySession.sessionId);
      if (!nextSession) {
        return {
          ...displaySession,
          loading: false,
          error: undefined,
          todos: displaySession.todos.map((todo) => {
            removeTodoAfterDelay(displaySession.sessionId, todo.id);
            return { ...todo, leaving: true };
          }),
        };
      }
      const existingByTodoId = new Map(displaySession.todos.map((todo) => [todo.id, todo]));
      const nextTodoIds = new Set(nextSession.todos.map((todo) => todo.id));
      const mergedTodos: DisplayTodo[] = [];
      nextSession.todos.forEach((todo) => {
        const key = timerKey(nextSession.sessionId, todo.id);
        clearRemoveTimer(key);
        const existing = existingByTodoId.get(todo.id);
        if (existing) {
          mergedTodos.push({ ...existing, ...todo, leaving: false });
          return;
        }
        mergedTodos.push({ ...todo, leaving: false });
      });
      displaySession.todos.forEach((todo) => {
        if (nextTodoIds.has(todo.id)) return;
        removeTodoAfterDelay(displaySession.sessionId, todo.id);
        mergedTodos.push({ ...todo, leaving: true });
      });
      return {
        ...displaySession,
        title: nextSession.title,
        isSubagent: nextSession.isSubagent,
        loading: nextSession.loading,
        error: nextSession.error,
        todos: mergedTodos,
      };
    });

    incoming.forEach((session) => {
      const exists = nextDisplay.some((item) => item.sessionId === session.sessionId);
      if (exists) return;
      nextDisplay.push({
        ...session,
        todos: session.todos.map((todo) => ({ ...todo, leaving: false })),
      });
    });

    displaySessions.value = nextDisplay;
    pruneEmptySessions();
  },
  { deep: true, immediate: true },
);

onBeforeUnmount(() => {
  removeTimers.forEach((timer) => {
    window.clearTimeout(timer);
  });
  removeTimers.clear();
});

function statusIcon(status: string) {
  if (status === 'completed') return '✓';
  if (status === 'in_progress') return '◐';
  if (status === 'cancelled') return '✕';
  return '○';
}
</script>

<style scoped>
.todo-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.todo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 10px 8px;
  border-bottom: 1px solid rgba(100, 116, 139, 0.28);
}

.todo-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #e2e8f0;
}

.todo-count {
  font-size: 11px;
  color: #94a3b8;
}

.todo-empty {
  margin: auto;
  color: rgba(148, 163, 184, 0.9);
  font-size: 12px;
}

.todo-groups {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-group {
  border: 1px solid rgba(71, 85, 105, 0.55);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.6);
}

.todo-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-bottom: 1px solid rgba(71, 85, 105, 0.42);
}

.todo-group-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
}

.todo-badge {
  margin-left: auto;
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid rgba(59, 130, 246, 0.5);
  color: #93c5fd;
  background: rgba(30, 64, 175, 0.25);
  font-size: 10px;
}

.todo-error {
  padding: 8px;
  color: #fca5a5;
  font-size: 11px;
}

.todo-list {
  list-style: none;
  margin: 0;
  padding: 6px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: #dbeafe;
  transition: all 0.24s ease;
}

.todo-item.is-leaving {
  opacity: 0.75;
}

.todo-status {
  width: 14px;
  text-align: center;
  color: #e2e8f0;
}

.todo-item.is-completed .todo-status {
  color: #86efac;
}

.todo-item.is-in_progress .todo-status {
  color: #fcd34d;
}

.todo-item.is-cancelled .todo-status {
  color: #fca5a5;
}

.todo-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.todo-priority {
  flex: 0 0 auto;
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.07em;
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 999px;
  padding: 2px 5px;
}

.todo-priority.is-high {
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.6);
}

.todo-priority.is-medium {
  color: #fde68a;
  border-color: rgba(250, 204, 21, 0.6);
}

.todo-priority.is-low {
  color: #86efac;
  border-color: rgba(74, 222, 128, 0.6);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.24s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.fade-move {
  transition: all 0.24s ease;
}
</style>
