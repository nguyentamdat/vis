<script setup lang="ts">
import { onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import {
  useQuota,
  calculatePace,
  worstUsedPercent,
  statusColor,
} from '../composables/useQuota';
import UsageCard from './UsageCard.vue';
import type { ProviderQuotaResult } from '../types/quota';

const quota = useQuota();

const WINDOW_LABELS: Record<string, string> = {
  '5h': '5-Hour',
  '7d': '7-Day',
  '7d-sonnet': '7-Day Sonnet',
  '7d-opus': '7-Day Opus',
  weekly: 'Weekly',
  credits: 'Credits',
  'monthly-spend': 'Monthly Spend',
};

function windowLabel(key: string): string {
  return WINDOW_LABELS[key] ?? key;
}

function lastUpdated(result: ProviderQuotaResult): string {
  if (!result.fetchedAt) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(result.fetchedAt),
  );
}

onMounted(() => quota.initialize());
</script>

<template>
  <div class="quota-panel">
    <div class="quota-toolbar">
      <div class="toolbar-left">
        <button
          type="button"
          class="ctrl-btn"
          :disabled="quota.isLoading.value"
          @click="quota.refreshAll()"
        >
          <Icon
            icon="lucide:refresh-cw"
            :width="13"
            :height="13"
            :class="{ spinning: quota.isLoading.value }"
          />
          Refresh
        </button>
        <label class="auto-label">
          <input
            type="checkbox"
            :checked="quota.autoRefresh.value"
            @change="quota.setAutoRefresh(!quota.autoRefresh.value)"
          />
          Auto
        </label>
        <select
          class="interval-select"
          :value="quota.refreshIntervalMs.value"
          :disabled="!quota.autoRefresh.value"
          @change="
            (e) =>
              quota.setRefreshInterval(
                Number((e.target as HTMLSelectElement).value) as 30000 | 60000 | 300000,
              )
          "
        >
          <option v-for="opt in quota.REFRESH_INTERVALS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div class="display-toggle">
        <button
          type="button"
          class="toggle-btn"
          :class="{ active: quota.displayMode.value === 'usage' }"
          @click="quota.displayMode.value = 'usage'"
        >
          Usage
        </button>
        <button
          type="button"
          class="toggle-btn"
          :class="{ active: quota.displayMode.value === 'remaining' }"
          @click="quota.displayMode.value = 'remaining'"
        >
          Remaining
        </button>
      </div>
    </div>

    <div v-if="quota.lastError.value" class="global-error">{{ quota.lastError.value }}</div>

    <div class="provider-list">
      <div v-for="result in quota.results.value" :key="result.providerId" class="provider-section">
        <div class="provider-header">
          <span
            class="status-dot"
            :style="{ backgroundColor: statusColor(worstUsedPercent(result)) }"
          />
          <span class="provider-name">{{ result.providerName }}</span>
          <span v-if="result.ok && result.fetchedAt" class="provider-time">
            {{ lastUpdated(result) }}
          </span>
          <span v-if="!result.configured" class="provider-badge not-set">Not set</span>
          <span v-else-if="result.error" class="provider-badge has-error">{{ result.error }}</span>
        </div>

        <template v-if="result.usage && result.ok">
          <UsageCard
            v-for="(win, key) in result.usage.windows"
            :key="key"
            :label="windowLabel(String(key))"
            :window="win"
            :pace="calculatePace(win)"
            :display-mode="quota.displayMode.value"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quota-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: inherit;
  font-size: 12px;
  color: #e2e8f0;
}

.quota-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid #334155;
  gap: 10px;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctrl-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #334155;
  border-radius: 5px;
  background: #0b1320;
  color: #e2e8f0;
  padding: 3px 8px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.ctrl-btn:hover:not(:disabled) {
  background: #1d2a45;
}

.ctrl-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.auto-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #94a3b8;
  cursor: pointer;
}

.auto-label input {
  margin: 0;
  width: 12px;
  height: 12px;
}

.interval-select {
  border: 1px solid #334155;
  border-radius: 4px;
  background: #0b1320;
  color: #e2e8f0;
  padding: 2px 4px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.interval-select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.display-toggle {
  display: inline-flex;
  border: 1px solid #334155;
  border-radius: 5px;
  overflow: hidden;
}

.toggle-btn {
  border: none;
  background: #0b1320;
  color: #94a3b8;
  padding: 3px 8px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn:hover {
  background: #1d2a45;
}

.toggle-btn.active {
  background: rgba(59, 130, 246, 0.25);
  color: #e2e8f0;
}

.global-error {
  padding: 8px 10px;
  color: #ef4444;
  font-size: 11px;
  text-align: center;
  border-bottom: 1px solid #334155;
}

.provider-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.provider-section {
  border-bottom: 1px solid #334155;
}

.provider-section:last-child {
  border-bottom: none;
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  background: rgba(15, 23, 42, 0.5);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.provider-name {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
}

.provider-time {
  margin-left: auto;
  font-size: 10px;
  color: #64748b;
}

.provider-badge {
  margin-left: auto;
  font-size: 10px;
  font-style: italic;
}

.provider-badge.not-set {
  color: #64748b;
}

.provider-badge.has-error {
  color: #ef4444;
}
</style>
