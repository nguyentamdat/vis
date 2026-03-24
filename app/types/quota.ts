export type UsageWindow = {
  /** 0–100 */
  usedPercent: number | null;
  /** 0–100 */
  remainingPercent: number | null;
  /** seconds (e.g. 18000 for 5h) */
  windowSeconds: number | null;
  resetAfterSeconds: number | null;
  /** unix ms */
  resetAt: number | null;
  resetAtFormatted: string | null;
  /** override label: "$4.20 remaining", "150 / 300 left" */
  valueLabel?: string | null;
};

export type ProviderUsage = {
  /** keyed by window label: "5h", "7d", "7d-sonnet", "weekly", "credits" */
  windows: Record<string, UsageWindow>;
  models?: Record<string, { windows: Record<string, UsageWindow> }>;
};

export type QuotaProviderId = 'claude' | 'openai' | 'kimi';

export type ProviderQuotaResult = {
  providerId: QuotaProviderId;
  providerName: string;
  ok: boolean;
  configured: boolean;
  error?: string;
  usage: ProviderUsage | null;
  /** unix ms */
  fetchedAt: number;
};

export type QuotaProvidersResponse = {
  providers: { id: QuotaProviderId; name: string; configured: boolean }[];
};

export type QuotaProviderResponse = ProviderQuotaResult;

export type PaceInfo = {
  /** %/h */
  ratePerHour: number;
  /** predicted % at window end */
  predictedFinal: number;
  status: 'on-track' | 'slightly-fast' | 'too-fast' | 'exhausted';
  rateLabel: string;
  predictionLabel: string;
};
