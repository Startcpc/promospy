export const ENGINE_VERSION=4;
export function integerSetting(name: string, fallback: number, min: number, max: number, env = process.env) {
  const raw = env[name];
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  return Math.min(max,Math.max(min,Number(raw)));
}
export function searchConfig() {
  return {
    pages:integerSetting('PROMO_SEARCH_MAX_PAGES',30,6,50),
    discoveryRequests:integerSetting('PROMO_SEARCH_DISCOVERY_REQUESTS',12,3,20),
    timeoutMs:integerSetting('PROMO_SEARCH_TIMEOUT_MS',90000,15000,180000),
    requestTimeoutMs:integerSetting('PROMO_HTTP_TIMEOUT_MS',10000,1000,15000),
    concurrency:integerSetting('PROMO_HTTP_CONCURRENCY',6,1,8),
    perHost:integerSetting('PROMO_HTTP_PER_HOST',2,1,2),
    intervalMs:integerSetting('PROMO_HTTP_INTERVAL_MS',500,100,10000),
    maxBytes:integerSetting('PROMO_HTTP_MAX_BYTES',4_000_000,100000,6_000_000),
    browser:process.env.PROMO_BROWSER_ENABLED === '1',
  };
}
