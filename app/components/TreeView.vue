<template>
  <div class="tree-view">
    <div class="tree-header">
      <div class="tree-title">TREE</div>
    </div>
    <div v-if="!rootNodes.length && !isLoading" class="tree-empty">No files.</div>
    <div v-else class="tree-scroll">
      <div
        v-for="row in visibleRows"
        :key="row.node.path"
        class="tree-row"
        :class="{
          'is-directory': row.node.type === 'directory',
          'is-file': row.node.type !== 'directory',
          'is-selected': selectedPath === row.node.path,
        }"
        :style="{ '--indent': String(row.depth) }"
        @click="onRowClick(row)"
        @dblclick="onRowDoubleClick(row)"
      >
        <button
          v-if="row.node.type === 'directory'"
          type="button"
          class="tree-toggle"
          :aria-label="isExpanded(row.node.path) ? 'Collapse directory' : 'Expand directory'"
          @click.stop="emit('toggle-dir', row.node.path)"
        >
          {{ isExpanded(row.node.path) ? '▾' : '▸' }}
        </button>
        <span v-else class="tree-toggle tree-toggle-spacer"></span>
        <span class="tree-icon">{{ row.node.type === 'directory' ? '📁' : '📄' }}</span>
        <span class="tree-name">{{ row.node.name }}</span>
        <span v-if="statusFor(row.node.path)" class="tree-status" :class="`is-${statusFor(row.node.path)}`">
          {{ statusLabel(statusFor(row.node.path)) }}
        </span>
      </div>
      <div v-if="isLoading" class="tree-loading">Loading...</div>
      <div v-if="error" class="tree-error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export type TreeNode = {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: TreeNode[];
};

type TreeStatus = 'added' | 'modified' | 'deleted';

const props = defineProps<{
  rootNodes: TreeNode[];
  expandedPaths: string[];
  selectedPath?: string;
  isLoading: boolean;
  error?: string;
  statusByPath?: Record<string, TreeStatus>;
}>();

const emit = defineEmits<{
  (event: 'toggle-dir', path: string): void;
  (event: 'select-file', path: string): void;
  (event: 'open-file', path: string): void;
}>();

const expanded = computed(() => new Set(props.expandedPaths));

const visibleRows = computed(() => {
  const rows: Array<{ node: TreeNode; depth: number }> = [];
  const pushRows = (nodes: TreeNode[], depth: number) => {
    nodes.forEach((node) => {
      rows.push({ node, depth });
      if (node.type === 'directory' && expanded.value.has(node.path) && node.children?.length) {
        pushRows(node.children, depth + 1);
      }
    });
  };
  pushRows(props.rootNodes, 0);
  return rows;
});

function isExpanded(path: string) {
  return expanded.value.has(path);
}

function statusFor(path: string) {
  return props.statusByPath?.[path];
}

function statusLabel(status?: TreeStatus) {
  if (status === 'added') return 'A';
  if (status === 'deleted') return 'D';
  if (status === 'modified') return 'M';
  return '';
}

function onRowClick(row: { node: TreeNode }) {
  if (row.node.type === 'directory') {
    emit('toggle-dir', row.node.path);
    return;
  }
  emit('select-file', row.node.path);
}

function onRowDoubleClick(row: { node: TreeNode }) {
  if (row.node.type !== 'directory') emit('open-file', row.node.path);
}
</script>

<style scoped>
.tree-view {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 10px 8px;
  border-bottom: 1px solid rgba(100, 116, 139, 0.28);
}

.tree-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #e2e8f0;
}

.tree-empty {
  margin: auto;
  color: rgba(148, 163, 184, 0.9);
  font-size: 12px;
}

.tree-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
  user-select: none;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 2px 6px 2px calc(4px + var(--indent) * 14px);
  border-radius: 6px;
  color: #dbeafe;
  cursor: pointer;
}

.tree-row:hover {
  background: rgba(51, 65, 85, 0.55);
}

.tree-row.is-selected {
  background: rgba(30, 64, 175, 0.4);
}

.tree-toggle {
  border: 0;
  background: transparent;
  color: #94a3b8;
  width: 16px;
  padding: 0;
  cursor: pointer;
}

.tree-toggle-spacer {
  display: inline-block;
}

.tree-icon {
  width: 16px;
  text-align: center;
}

.tree-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-status {
  min-width: 16px;
  text-align: center;
  font-size: 10px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.45);
}

.tree-status.is-added {
  color: #86efac;
  border-color: rgba(74, 222, 128, 0.6);
}

.tree-status.is-modified {
  color: #fde68a;
  border-color: rgba(250, 204, 21, 0.6);
}

.tree-status.is-deleted {
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.6);
}

.tree-loading,
.tree-error {
  margin-top: 8px;
  font-size: 11px;
  color: #94a3b8;
}

.tree-error {
  color: #fca5a5;
}
</style>
