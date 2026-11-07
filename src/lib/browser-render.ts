/**
 * Optional JavaScript rendering for public pages that respond with an empty app shell.
 * Never runs after a 401/403/429, challenge or CAPTCHA, and does not try to evade them.
 */
export function looksLikeClientRenderedShell(html: string): boolean {
  if (!/<script\b[^>]*src\s*=/i.test(html)) return false;
  if (!/<(?:div|main)\b[^>]*id\s*=\s*["'](?:root|app|__next)["']/i.test(html)) return false;
  const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return visible.length < 220;
}

function allowed(url: string, domains: string[]): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      domains.includes(u.hostname.toLowerCase().replace(/^www\./, ''));
  } catch {
    return false;
  }
}

/** Explicit opt-in; browser assets must be installed once with playwright install chromium. */
export async function renderPublicPage(
  url: string, domains: string[], signal: AbortSignal,
): Promise<string | null> {
  if (process.env.PROMO_RENDER_JS !== '1' || !allowed(url, domains)) return null;
  signal.throwIfAborted();
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const abort = () => { void browser.close().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const context = await browser.newContext({
      locale: 'ru-RU',
      viewport: { width: 1280, height: 800 },
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.route('**/*', async (route) => {
      const request = route.request();
      const type = request.resourceType();
      if (!allowed(request.url(), domains) || ['image', 'media', 'font', 'websocket'].includes(type)) {
        await route.abort().catch(() => {});
      } else {
        await route.continue().catch(() => {});
      }
    });
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    if (!response || response.status() >= 400 || !allowed(page.url(), domains)) return null;
    await page.waitForTimeout(700);
    signal.throwIfAborted();
    return await page.content();
  } finally {
    signal.removeEventListener('abort', abort);
    await browser.close().catch(() => {});
  }
}
