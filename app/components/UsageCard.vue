<script setup lang="ts">
import { computed } from 'vue';
import type { UsageWindow, PaceInfo } from '../types/quota';

interface Props {
  label: string;
  window: UsageWindow;
  pace: PaceInfo | null;
  displayMode: 'usage' | 'remaining';
}

const props = defineProps<Props>();


const displayValue = computed(() => {
  if (props.window.valueLabel) {
    return props.window.valueLabel;
  }
  const percent = props.displayMode === 'remaining'
    ? props.window.remainingPercent
    : props.window.usedPercent;
  if (percent == null) return '--';
  return `${Math.round(percent)}%`;
});

const barColor = computed(() => {
  const used = props.window.usedPercent ?? 0;
  if (used >= 80) return '#ef4444';
  if (used >= 50) return '#f59e0b';
  return '#22c55e';
});

const barFillPercent = computed(() => {
  const used = props.window.usedPercent ?? 0;
  return Math.min(100, Math.max(0, used));
});

const resetTime = computed(() => props.window.resetAtFormatted);

const paceDotColor = computed(() => {
  if (!props.pace) return '#64748b';
  switch (props.pace.status) {
    case 'on-track':
      return '#22c55e';
    case 'slightly-fast':
      return '#f59e0b';
    case 'too-fast':
    case 'exhausted':
      return '#ef4444';
    default:
      return '#64748b';
  }
});
</script>

<template>
  <div class="usage-card">
    <div class="usage-row">
      <span class="usage-label">{{ label }}</span>
      <span class="usage-value">{{ displayValue }}</span>
    </div>
    <div class="usage-bar-bg">
      <div
        class="usage-bar-fill"
        :style="{
          width: `${barFillPercent}%`,
          backgroundColor: barColor,
        }"
      />
    </div>
    <div class="usage-row">
      <span v-if="resetTime" class="usage-reset">Resets {{ resetTime }}</span>
      <span v-else class="usage-reset-placeholder"></span>
      <span v-if="pace" class="usage-pace">
        <span class="pace-dot" :style="{ backgroundColor: paceDotColor }"></span>
        <span class="pace-rate">{{ pace.rateLabel }}</span>
        <span class="pace-prediction">{{ pace.predictionLabel }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.usage-card {
  padding: 8px 10px;
  border-bottom: 1px solid #334155;
}

.usage-card:last-child {
  border-bottom: none;
}

.usage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.usage-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
}

.usage-value {
  font-size: 11px;
  color: #e2e8f0;
  font-weight: 600;
}

.usage-bar-bg {
  height: 4px;
  background: #334155;
  border-radius: 2px;
  margin: 6px 0;
  overflow: hidden;
}

.usage-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.2s ease;
}

.usage-reset {
  font-size: 10px;
  color: #64748b;
}

.usage-reset-placeholder {
  flex: 1;
}

.usage-pace {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #94a3b8;
}

.pace-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pace-rate {
  color: #cbd5e1;
}

.pace-prediction {
  color: #64748b;
}
</style>
