<template>
  <aside class="side-panel" :class="{ 'is-collapsed': collapsed }">
    <button
      v-if="collapsed"
      type="button"
      class="side-toggle side-toggle-collapsed"
      :aria-expanded="!collapsed"
      aria-label="Expand side panel"
      @click="emit('toggle-collapse')"
    >
      <Icon icon="lucide:chevron-right" width="14" height="14" />
    </button>
    <div v-else class="side-body">
      <div class="side-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="side-tab"
          :class="{ 'is-active': activeTab === tab.id }"
          @click="emit('change-tab', tab.id)"
        >
          {{ tab.label }}
        </button>
        <button
          type="button"
          class="side-toggle side-toggle-inline"
          :aria-expanded="!collapsed"
          aria-label="Collapse side panel"
          @click="emit('toggle-collapse')"
        >
          <Icon icon="lucide:chevron-left" width="14" height="14" />
        </button>
      </div>
      <TodoList v-show="activeTab === 'todo'" :sessions="todoSessions" />
      <TreeView
        :key="treeDirectoryName"
        v-show="activeTab === 'tree'"
        :root-nodes="treeNodes"
        :expanded-paths="expandedTreePaths"
        :selected-path="selectedTreePath"
        :is-loading="treeLoading"
        :error="treeError"
        :git-status-by-path="treeStatusByPath"
        :branch-info="treeBranchInfo"
        :diff-stats="treeDiffStats"
        :directory-name="treeDirectoryName"
        :branch-entries="treeBranchEntries"
        :branch-list-loading="treeBranchListLoading"
        :run-shell-command="runShellCommand"
        @toggle-dir="(path) => emit('toggle-dir', path)"
        @select-file="(path) => emit('select-file', path)"
        @open-diff="(payload) => emit('open-diff', payload)"
        @open-diff-all="(payload) => emit('open-diff-all', payload)"
        @open-file="(path) => emit('open-file', path)"
        @reload="emit('reload')"
      />
      <div v-show="activeTab === 'agents'" class="agents-body">
        <div class="agents-header">
          <div class="agents-title">AGENTS</div>
          <div class="agents-count">{{ subagentEntries.length }}</div>
        </div>
        <div v-if="subagentEntries.length === 0" class="agents-empty">No subagents.</div>
        <div v-else class="agents-list">
          <div
            v-for="entry in subagentEntries"
            :key="entry.sessionId"
            class="agent-card"
            :class="`is-${entry.status}`"
          >
            <div class="agent-card-header">
              <span class="agent-status-dot" :class="`is-${entry.status}`" />
              <span class="agent-card-badge">{{ agentBadgeLabel(entry) }}</span>
              <span class="agent-card-status" :class="`is-${entry.status}`">{{ entry.status }}</span>
            </div>
            <div v-if="entry.description" class="agent-card-desc">{{ entry.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { toRefs } from 'vue';
import { Icon } from '@iconify/vue';
import TodoList from './TodoList.vue';
import type { BranchEntry } from '../composables/useFileTree';
import TreeView, {
  type GitBranchInfo,
  type GitDiffStats,
  type GitFileStatus,
  type TreeNode,
} from './TreeView.vue';

type TodoItem = {
  content: string;
  status: string;
  priority: string;
};

type TodoPanelSession = {
  sessionId: string;
  title: string;
  isSubagent: boolean;
  todos: TodoItem[];
  loading: boolean;
  error: string | undefined;
};

type SubagentEntry = {
  sessionId: string;
  label: string;
  status: 'busy' | 'idle' | 'retry' | 'unknown';
  agent: string;
  description: string;
  model: string;
};

const props = defineProps<{
  collapsed: boolean;
  activeTab: 'todo' | 'tree' | 'agents';
  todoSessions: TodoPanelSession[];
  subagentEntries: SubagentEntry[];
  treeNodes: TreeNode[];
  expandedTreePaths: string[];
  selectedTreePath?: string;
  treeLoading: boolean;
  treeError?: string;
  treeStatusByPath: Record<string, GitFileStatus>;
  treeBranchInfo?: GitBranchInfo | null;
  treeDiffStats?: GitDiffStats | null;
  treeDirectoryName?: string;
  treeBranchEntries?: BranchEntry[];
  treeBranchListLoading?: boolean;
  runShellCommand?: (command: string) => Promise<void>;
}>();

const emit = defineEmits<{
  (event: 'toggle-collapse'): void;
  (event: 'change-tab', value: 'todo' | 'tree' | 'agents'): void;
  (event: 'toggle-dir', path: string): void;
  (event: 'select-file', path: string): void;
  (event: 'open-diff', payload: { path: string; staged: boolean }): void;
  (event: 'open-diff-all', payload: { mode: 'staged' | 'changes' | 'all' }): void;
  (event: 'open-file', path: string): void;
  (event: 'reload'): void;
}>();

const tabs = [
  { id: 'todo' as const, label: 'TODO' },
  { id: 'tree' as const, label: 'TREE' },
  { id: 'agents' as const, label: 'AGENTS' },
];

const {
  collapsed,
  activeTab,
  todoSessions,
  subagentEntries,
  treeNodes,
  expandedTreePaths,
  selectedTreePath,
  treeLoading,
  treeError,
  treeStatusByPath,
  treeBranchInfo,
  treeDiffStats,
  treeDirectoryName,
  treeBranchEntries,
  treeBranchListLoading,
  runShellCommand,
} = toRefs(props);

function agentBadgeLabel(entry: SubagentEntry): string {
  const parts = [entry.agent, entry.model].filter(Boolean);
  return parts.length > 0 ? parts.join(' \u00b7 ').toUpperCase() : 'AGENT';
}
</script>

<style scoped>
.side-panel {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: row;
  border: 1px solid #334155;
  border-radius: 12px;
  background-clip: padding-box;
  background: rgba(12, 18, 30, 0.95);
  box-shadow: 0 10px 24px rgba(2, 6, 23, 0.35);
  overflow: hidden;
}

.side-toggle {
  width: 26px;
  height: 26px;
  border: 1px solid rgba(100, 116, 139, 0.45);
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.92);
  color: #cbd5e1;
  cursor: pointer;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.side-toggle:hover {
  background: rgba(51, 65, 85, 0.95);
}

.side-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.side-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid rgba(71, 85, 105, 0.42);
}

.side-tab {
  flex: 1;
  border: 1px solid rgba(100, 116, 139, 0.35);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.7);
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 5px 0;
  cursor: pointer;
}

.side-tab.is-active {
  background: rgba(30, 64, 175, 0.45);
  color: #e2e8f0;
  border-color: rgba(96, 165, 250, 0.6);
}

.side-panel.is-collapsed {
  border-color: rgba(100, 116, 139, 0.45);
}

.side-toggle-inline {
  margin-left: auto;
}

.side-toggle-collapsed {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0;
}

.agents-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.agents-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 10px 8px;
  border-bottom: 1px solid rgba(100, 116, 139, 0.28);
}

.agents-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #e2e8f0;
}

.agents-count {
  font-size: 11px;
  color: #94a3b8;
}

.agents-empty {
  margin: auto;
  color: rgba(148, 163, 184, 0.9);
  font-size: 12px;
}

.agents-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agent-card {
  border: 1px solid rgba(71, 85, 105, 0.55);
  border-radius: 8px;
  padding: 7px 8px;
  background: rgba(15, 23, 42, 0.6);
}

.agent-card.is-busy {
  border-color: rgba(250, 204, 21, 0.5);
}

.agent-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.agent-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #64748b;
}

.agent-status-dot.is-busy {
  background: #facc15;
  box-shadow: 0 0 4px rgba(250, 204, 21, 0.6);
}

.agent-status-dot.is-idle {
  background: #4ade80;
}

.agent-status-dot.is-retry {
  background: #f87171;
}

.agent-card-badge {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #e2e8f0;
  background: #334155;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-card-status {
  font-size: 10px;
  color: #64748b;
  margin-left: auto;
  flex-shrink: 0;
}

.agent-card-status.is-busy {
  color: #fbbf24;
}

.agent-card-status.is-idle {
  color: #4ade80;
}

.agent-card-status.is-retry {
  color: #f87171;
}

.agent-card-desc {
  margin-top: 3px;
  padding-left: 13px;
  font-size: 11px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
