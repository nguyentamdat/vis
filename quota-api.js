import { join } from 'node:path';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';

const providerCache = new Map();
const CACHE_TTL_MS = 60_000;
const KNOWN_PROVIDERS = [
  { id: 'claude', name: 'Claude' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'kimi', name: 'Kimi' },
];

function clampPercent(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function toResetInfo(rawResetAt) {
  if (rawResetAt == null) {
    return { resetAt: null, resetAfterSeconds: null, resetAtFormatted: null };
  }

  let resetAt = null;
  if (typeof rawResetAt === 'number' && Number.isFinite(rawResetAt)) {
    resetAt = rawResetAt < 1_000_000_000_000 ? rawResetAt * 1000 : rawResetAt;
  } else if (typeof rawResetAt === 'string') {
    const parsed = Date.parse(rawResetAt);
    if (Number.isFinite(parsed)) resetAt = parsed;
  }

  if (resetAt == null) {
    return { resetAt: null, resetAfterSeconds: null, resetAtFormatted: null };
  }

  const now = Date.now();
  const resetDate = new Date(resetAt);
  const today = new Date(now);
  const isSameDay =
    resetDate.getFullYear() === today.getFullYear() &&
    resetDate.getMonth() === today.getMonth() &&
    resetDate.getDate() === today.getDate();

  const resetAtFormatted = isSameDay
    ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(resetDate)
    : new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(resetDate);

  return {
    resetAt,
    resetAfterSeconds: resetAt > now ? Math.floor((resetAt - now) / 1000) : null,
    resetAtFormatted: resetAt > now ? resetAtFormatted : null,
  };
}
function createWindow({ usedPercent, remainingPercent, windowSeconds, resetRaw, valueLabel = null }) {
  const resetInfo = toResetInfo(resetRaw);
  return {
    usedPercent: clampPercent(usedPercent),
    remainingPercent: clampPercent(remainingPercent),
    windowSeconds: Number.isFinite(windowSeconds) ? windowSeconds : null,
    resetAfterSeconds: resetInfo.resetAfterSeconds,
    resetAt: resetInfo.resetAt,
    resetAtFormatted: resetInfo.resetAtFormatted,
    valueLabel,
  };
}

function usageFromUtilization(windowSeconds, utilization, resetRaw) {
  if (!Number.isFinite(utilization)) {
    return createWindow({ usedPercent: null, remainingPercent: null, windowSeconds, resetRaw });
  }
  const usedPercent = utilization > 1 ? utilization : utilization * 100;
  return createWindow({ usedPercent, remainingPercent: 100 - usedPercent, windowSeconds, resetRaw });
}

function usageFromLimitRemaining(windowSeconds, limit, remaining, resetRaw) {
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(remaining)) {
    return createWindow({ usedPercent: null, remainingPercent: null, windowSeconds, resetRaw });
  }
  const remainingPercent = (remaining / limit) * 100;
  return createWindow({ usedPercent: 100 - remainingPercent, remainingPercent, windowSeconds, resetRaw });
}

function resultBase(providerId, providerName, configured) {
  return { providerId, providerName, ok: false, configured, usage: null, fetchedAt: Date.now() };
}

async function readAuthConfig() {
  try {
    const raw = await readFile(join(homedir(), '.local/share/opencode/auth.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getClaudeToken(auth) {
  const access = auth?.anthropic?.access;
  if (typeof access === 'string' && access.length > 0) return access;
  const env = process.env.ANTHROPIC_API_KEY;
  return typeof env === 'string' && env.length > 0 ? env : null;
}

function getOpenAIOAuthToken(auth) {
  if (auth?.openai?.type !== 'oauth') return null;
  const access = auth?.openai?.access;
  return typeof access === 'string' && access.length > 0 ? access : null;
}

function getOpenAIApiKey() {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

function getKimiKey(auth) {
  const env = process.env.KIMI_API_KEY;
  if (typeof env === 'string' && env.length > 0) return env;
  const key = auth?.['kimi-for-coding']?.key ?? auth?.kimi?.key;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

function isConfigured(providerId, auth) {
  if (providerId === 'claude') return Boolean(getClaudeToken(auth));
  if (providerId === 'openai') return Boolean(getOpenAIOAuthToken(auth) || getOpenAIApiKey());
  if (providerId === 'kimi') return Boolean(getKimiKey(auth));
  return false;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchClaude(auth) {
  const token = getClaudeToken(auth);
  const result = resultBase('claude', 'Claude', Boolean(token));
  if (!token) { result.error = 'Not configured'; return result; }

  try {
    const data = await fetchJson('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'claude-code/1.0',
      },
    });

    const windows = {};
    const add = (key, src, secs) => {
      if (!src || typeof src !== 'object') return;
      windows[key] = usageFromUtilization(secs, typeof src.utilization === 'number' ? src.utilization : NaN, src.resets_at);
    };
    add('5h', data?.five_hour, 18_000);
    add('7d', data?.seven_day, 604_800);
    add('7d-sonnet', data?.seven_day_sonnet, 604_800);
    add('7d-opus', data?.seven_day_opus, 604_800);

    result.ok = true;
    result.usage = { windows };
  } catch (e) {
    result.error = e instanceof Error ? e.message : 'Failed to fetch';
  }
  return result;
}

async function fetchOpenAI(auth) {
  const oauth = getOpenAIOAuthToken(auth);
  const apiKey = getOpenAIApiKey();
  const result = resultBase('openai', 'OpenAI', Boolean(oauth || apiKey));
  if (!result.configured) { result.error = 'Not configured'; return result; }

  if (oauth) {
    try {
      const payload = await fetchJson('https://chatgpt.com/backend-api/wham/usage', {
        headers: { Authorization: `Bearer ${oauth}` },
      });
      const windows = {};
      const rl = payload?.rate_limit;
      if (rl && typeof rl === 'object') {
        const mapWindow = (src, key, secs) => {
          if (!src || typeof src !== 'object') return;
          const pct = src.used_percent ?? src.utilization;
          const reset = src.reset_at ?? src.resets_at;
          windows[key] = usageFromUtilization(secs, typeof pct === 'number' ? pct : NaN, reset);
        };
        mapWindow(rl.primary_window, '5h', 18_000);
        mapWindow(rl.secondary_window, 'weekly', 604_800);
      }
      const credits = payload?.credits;
      if (credits && typeof credits === 'object') {
        const balance = Number(credits.balance);
        if (Number.isFinite(balance) && balance > 0) {
          windows.credits = createWindow({ usedPercent: null, remainingPercent: null, windowSeconds: null, resetRaw: null, valueLabel: `$${balance.toFixed(2)} balance` });
        }
      }
      result.ok = true;
      result.usage = { windows };
    } catch (e) {
      result.error = e instanceof Error ? e.message : 'Failed to fetch';
    }
    return result;
  }

  try {
    const startTime = Math.floor((Date.now() - 30 * 86_400_000) / 1000);
    const payload = await fetchJson(`https://api.openai.com/v1/organization/costs?start_time=${startTime}&bucket_width=1d`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    let total = 0;
    for (const bucket of Array.isArray(payload?.data) ? payload.data : []) {
      for (const row of Array.isArray(bucket?.results) ? bucket.results : []) {
        const v = Number(row?.amount?.value ?? row?.cost ?? row?.amount);
        if (Number.isFinite(v)) total += v;
      }
    }
    result.ok = true;
    result.usage = { windows: { 'monthly-spend': createWindow({ usedPercent: null, remainingPercent: null, windowSeconds: 30 * 86_400, resetRaw: null, valueLabel: `$${total.toFixed(2)} this month` }) } };
  } catch (e) {
    result.error = e instanceof Error ? e.message : 'Failed to fetch';
  }
  return result;
}

function parseKimiDuration(windowConfig) {
  const duration = Number(windowConfig?.duration);
  const unit = windowConfig?.timeUnit;
  if (!Number.isFinite(duration) || duration <= 0 || typeof unit !== 'string') return null;
  const multipliers = { TIME_UNIT_SECOND: 1, TIME_UNIT_MINUTE: 60, TIME_UNIT_HOUR: 3600, TIME_UNIT_DAY: 86_400, TIME_UNIT_WEEK: 604_800 };
  if (!multipliers[unit]) return null;
  const totalSeconds = duration * multipliers[unit];
  if (totalSeconds >= 3600 && totalSeconds % 3600 === 0) return { key: `${totalSeconds / 3600}h`, windowSeconds: totalSeconds };
  if (totalSeconds >= 86_400 && totalSeconds % 86_400 === 0) return { key: `${totalSeconds / 86_400}d`, windowSeconds: totalSeconds };
  const suffixes = { TIME_UNIT_SECOND: 's', TIME_UNIT_MINUTE: 'm', TIME_UNIT_HOUR: 'h', TIME_UNIT_DAY: 'd', TIME_UNIT_WEEK: 'w' };
  return { key: `${duration}${suffixes[unit]}`, windowSeconds: totalSeconds };
}

async function fetchKimi(auth) {
  const apiKey = getKimiKey(auth);
  const result = resultBase('kimi', 'Kimi', Boolean(apiKey));
  if (!apiKey) { result.error = 'Not configured'; return result; }

  try {
    const payload = await fetchJson('https://api.kimi.com/coding/v1/usages', {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    const windows = {};
    const usage = payload?.usage;
    if (usage && typeof usage === 'object') {
      windows.weekly = usageFromLimitRemaining(604_800, Number(usage.limit), Number(usage.remaining), usage.resetTime);
    }
    for (const item of Array.isArray(payload?.limits) ? payload.limits : []) {
      const parsed = parseKimiDuration(item?.window);
      if (!parsed) continue;
      let key = parsed.key;
      let n = 2;
      while (windows[key]) { key = `${parsed.key}-${n++}`; }
      windows[key] = usageFromLimitRemaining(parsed.windowSeconds, Number(item?.detail?.limit), Number(item?.detail?.remaining), item?.detail?.resetTime);
    }
    result.ok = true;
    result.usage = { windows };
  } catch (e) {
    result.error = e instanceof Error ? e.message : 'Failed to fetch';
  }
  return result;
}

const fetchers = { claude: fetchClaude, openai: fetchOpenAI, kimi: fetchKimi };

export async function getProviders() {
  const auth = await readAuthConfig();
  return {
    providers: KNOWN_PROVIDERS.map((p) => ({ id: p.id, name: p.name, configured: isConfigured(p.id, auth) })),
  };
}

export async function getProviderQuota(providerId) {
  if (!fetchers[providerId]) return null;

  const cached = providerCache.get(providerId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const auth = await readAuthConfig();
  const result = await fetchers[providerId](auth);
  providerCache.set(providerId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export { KNOWN_PROVIDERS };
