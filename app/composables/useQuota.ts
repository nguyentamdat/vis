import { ref, computed, onUnmounted, type Ref } from 'vue';
import type {
  QuotaProviderId,
  ProviderQuotaResult,
  QuotaProvidersResponse,
  UsageWindow,
  PaceInfo,
} from '../types/quota';

export type DisplayMode = 'usage' | 'remaining';
export type RefreshInterval = 30_000 | 60_000 | 300_000;

const REFRESH_INTERVALS: { label: string; value: RefreshInterval }[] = [
  { label: '30s', value: 30_000 },
  { label: '1m', value: 60_000 },
  { label: '5m', value: 300_000 },
];

function getQuotaApiBase(): string {
  return window.location.origin;
}

async function fetchQuotaProviders(): Promise<QuotaProvidersResponse> {
  const res = await fetch(`${getQuotaApiBase()}/api/quota/providers`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchProviderQuota(providerId: QuotaProviderId): Promise<ProviderQuotaResult> {
  const res = await fetch(`${getQuotaApiBase()}/api/quota/${providerId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function calculatePace(window: UsageWindow): PaceInfo | null {
  const { usedPercent, windowSeconds, resetAt } = window;
  if (usedPercent == null || windowSeconds == null || resetAt == null) return null;
  if (windowSeconds <= 0) return null;

  const now = Date.now();
  const windowStartMs = resetAt - windowSeconds * 1000;
  const elapsedMs = now - windowStartMs;
  if (elapsedMs <= 0) return null;

  const elapsedRatio = elapsedMs / (windowSeconds * 1000);
  if (elapsedRatio <= 0) return null;

  const usageRatio = usedPercent / 100;

  if (usedPercent >= 100) {
    const remainingMs = Math.max(0, resetAt - now);
    const remainingH = Math.floor(remainingMs / 3_600_000);
    const remainingM = Math.floor((remainingMs % 3_600_000) / 60_000);
    return {
      ratePerHour: 0,
      predictedFinal: 100,
      status: 'exhausted',
      rateLabel: 'Used up',
      predictionLabel: remainingMs > 0 ? `Wait ${remainingH}h ${remainingM}m` : 'Resetting...',
    };
  }

  const elapsedHours = elapsedMs / 3_600_000;
  const ratePerHour = elapsedHours > 0 ? usedPercent / elapsedHours : 0;
  const predictedFinal = elapsedRatio > 0 ? (usageRatio / elapsedRatio) * 100 : 0;

  let status: PaceInfo['status'];
  if (usageRatio <= elapsedRatio) status = 'on-track';
  else if (predictedFinal <= 130) status = 'slightly-fast';
  else status = 'too-fast';

  const rateLabel =
    windowSeconds >= 86_400 ? `${(ratePerHour * 24).toFixed(1)}%/d` : `${ratePerHour.toFixed(1)}%/h`;

  const predictionLabel = predictedFinal > 100 ? `+${Math.round(predictedFinal)}%` : `Pred: ${Math.round(predictedFinal)}%`;

  return { ratePerHour, predictedFinal, status, rateLabel, predictionLabel };
}

export function worstUsedPercent(result: ProviderQuotaResult): number | null {
  if (!result.usage) return null;
  let worst: number | null = null;
  for (const w of Object.values(result.usage.windows)) {
    if (w.usedPercent != null && (worst == null || w.usedPercent > worst)) {
      worst = w.usedPercent;
    }
  }
  return worst;
}

export function statusColor(usedPercent: number | null): string {
  if (usedPercent == null) return '#64748b';
  if (usedPercent >= 80) return '#ef4444';
  if (usedPercent >= 50) return '#f59e0b';
  return '#22c55e';
}

export function useQuota() {
  const results: Ref<ProviderQuotaResult[]> = ref([]);
  const providerList: Ref<QuotaProvidersResponse['providers']> = ref([]);
  const selectedProviderId: Ref<QuotaProviderId | null> = ref(null);
  const isLoading = ref(false);
  const displayMode: Ref<DisplayMode> = ref('usage');
  const autoRefresh = ref(false);
  const refreshIntervalMs: Ref<RefreshInterval> = ref(60_000);
  const lastError = ref<string | null>(null);
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  const selectedResult = computed(() =>
    results.value.find((r) => r.providerId === selectedProviderId.value) ?? null,
  );

  const configuredProviders = computed(() =>
    providerList.value.filter((p) => p.configured),
  );

  async function loadProviders() {
    try {
      const data = await fetchQuotaProviders();
      providerList.value = data.providers;
      if (!selectedProviderId.value && data.providers.length > 0) {
        const firstConfigured = data.providers.find((p) => p.configured);
        selectedProviderId.value = (firstConfigured?.id ?? data.providers[0].id) as QuotaProviderId;
      }
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Failed to load providers';
    }
  }

  async function refreshAll() {
    isLoading.value = true;
    lastError.value = null;
    try {
      const configured = providerList.value.filter((p) => p.configured);
      const fetched = await Promise.all(
        configured.map((p) => fetchProviderQuota(p.id as QuotaProviderId).catch((e): ProviderQuotaResult => ({
          providerId: p.id as QuotaProviderId,
          providerName: p.name,
          ok: false,
          configured: true,
          error: e instanceof Error ? e.message : 'Fetch failed',
          usage: null,
          fetchedAt: Date.now(),
        }))),
      );
      results.value = fetched;
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Refresh failed';
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshProvider(providerId: QuotaProviderId) {
    try {
      const data = await fetchProviderQuota(providerId);
      const idx = results.value.findIndex((r) => r.providerId === providerId);
      if (idx >= 0) {
        results.value[idx] = data;
      } else {
        results.value.push(data);
      }
    } catch {
      // individual refresh failure is non-fatal
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    if (!autoRefresh.value) return;
    refreshTimer = setInterval(() => refreshAll(), refreshIntervalMs.value);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function setAutoRefresh(enabled: boolean) {
    autoRefresh.value = enabled;
    if (enabled) startAutoRefresh();
    else stopAutoRefresh();
  }

  function setRefreshInterval(ms: RefreshInterval) {
    refreshIntervalMs.value = ms;
    if (autoRefresh.value) startAutoRefresh();
  }

  function toggleDisplayMode() {
    displayMode.value = displayMode.value === 'usage' ? 'remaining' : 'usage';
  }

  async function initialize() {
    await loadProviders();
    await refreshAll();
  }

  onUnmounted(() => stopAutoRefresh());

  return {
    results,
    providerList,
    selectedProviderId,
    selectedResult,
    configuredProviders,
    isLoading,
    displayMode,
    autoRefresh,
    refreshIntervalMs,
    lastError,
    REFRESH_INTERVALS,
    initialize,
    refreshAll,
    refreshProvider,
    setAutoRefresh,
    setRefreshInterval,
    toggleDisplayMode,
  };
}
