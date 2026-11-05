import { createRequire } from "node:module";
import type { Browser, Locator, Page } from "playwright";
import { parsePromoCodesFromHtml } from "./promo-parser";
import type { PromoCode } from "./promocodes";
import type { OfficialSnapshot } from "./official-snapshot";
export type { OfficialSnapshot } from "./official-snapshot";
const { load } = createRequire(import.meta.url)("cheerio") as typeof import("cheerio");

export const TANUKI_MOSCOW_URL = "https://tanukifamily.ru/tanuki/msk/";
export const MAX_MANUAL_OBSERVATION_AGE_MS = 6 * 60 * 60 * 1000;

export function isTanukiActionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === "https://tanukifamily.ru" && /^\/tanuki\/(?:msk\/)?actions\/[a-z0-9-]+\/?$/.test(url.pathname) && !url.search && !url.hash;
  } catch { return false; }
}

/** Only text explicitly introduced as a promo code in the action itself. */
export function parseTanukiAction(html: string, url: string, now = Date.now()): PromoCode[] {
  if (!isTanukiActionUrl(url)) throw new Error("Неофициальный адрес акции Тануки");
  const $ = load(html);
  $("script, style, nav, header, footer").remove();
  const heading = $("h1").first().text().trim();
  const paragraphs = $("p").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean);
  if (!heading || !paragraphs.length) throw new Error("Не распознаны заголовок и условия официальной акции");
  const body = paragraphs.join(" ");
  const codes = [...body.matchAll(/[Пп]ромокод(?:ом|у|а)?\s*[:—–-]?\s*[«"“]?([A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9_-]{1,63})(?=[\s.,;!?»"”]|$)/gu)].map((match) => match[1]);
  // The label may be capitalized. Do not use case-insensitive matching for the actual code.
  if (/[Пп]ромокод(?:ом|у|а)?\s+[A-ZА-ЯЁ0-9]{2}/u.test(body) && !codes.length) throw new Error("Изменился формат промокода в официальной акции");
  const expiry = body.match(/(?:действует|акци[яи])[\s\S]{0,60}?(?:до|по)\s+(\d{2}\.\d{2}\.\d{4})/i)?.[1];
  return parsePromoCodesFromHtml(JSON.stringify([...new Set(codes)].map((promoCode) => ({ promoCode, title: heading,
    discountPercent: body.match(/скидк[ауи]?\s+(\d+)\s*%/i)?.[1], expiresAt: expiry, conditions: ["Москва", ...paragraphs] }))), url, 301, now)
    .map((code) => ({ ...code, status: code.status === "expired" ? "expired" : "official", checked: now,
      verificationDetails: "Код опубликован Тануки для Москвы. Применение в корзине не проверялось.",
      evidence: { method: "source", observedAt: now, message: heading, region: "Москва", sourceUrl: url } }));
}

/** Initial challenge responses are not the final rendered page. Allow normal site JS to finish. */
export async function waitForTanukiContent(page: Page, content: Locator, initialStatus?: number) {
  try {
    await content.waitFor({ state: "visible", timeout: 25000 });
  } catch {
    const text = await page.locator("body").innerText().catch(() => "");
    const qrator = await page.locator('script[src*="/__qrator/"]').count().catch(() => 0);
    if (qrator || /QRATOR|403\s*Error|Forbidden|Доступ.{0,80}запрещ/i.test(text)) {
      throw new Error(`QRATOR: после выполнения JavaScript доступ не предоставлен (начальный HTTP ${initialStatus ?? "?"}). Список акций не получен.`);
    }
    throw new Error(`Не дождались содержимого Тануки (начальный HTTP ${initialStatus ?? "?"}). Возможны ошибка загрузки или изменение страницы.`);
  }
}

/** Public, anonymous pages only. No cart, sign-in, cookies from a personal profile or order creation. */
export async function collectTanukiOfficial(signal: AbortSignal): Promise<OfficialSnapshot> {
  const snapshot: OfficialSnapshot = { codes: [], complete: false, observedAt: Date.now() };
  let browser: Browser | undefined;
  const cancel = () => { void browser?.close().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 100_000);
  try {
    signal.throwIfAborted();
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, timeout: 15000 });
    signal.throwIfAborted();
    const page = await browser.newPage({ locale: "ru-RU" });
    page.setDefaultTimeout(7000);
    const response = await page.goto(TANUKI_MOSCOW_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    await waitForTanukiContent(page, page.getByPlaceholder("Поиск по меню", { exact: true }), response?.status());
    if (!/Москва/.test(await page.getByRole("banner").innerText()) || !new URL(page.url()).pathname.startsWith("/tanuki/msk")) throw new Error("Не подтверждён регион Москва");
    const links = await page.locator('a[href*="/actions/"]').evaluateAll((elements) => elements.map((element) => (element as HTMLAnchorElement).href));
    const urls = [...new Set(links)].filter(isTanukiActionUrl);
    if (!urls.length || urls.length > 30) throw new Error("Не распознан полный список официальных акций");
    const errors: string[] = [];
    for (const url of urls) {
      signal.throwIfAborted();
      try {
        const actionResponse = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { level: 1 }) });
        await waitForTanukiContent(page, dialog, actionResponse?.status());
        if (!isTanukiActionUrl(page.url())) throw new Error("Акция перенаправила на другую страницу");
        const html = await dialog.evaluate((element) => element.outerHTML);
        snapshot.codes.push(...parseTanukiAction(html, url, snapshot.observedAt));
      } catch (error) { errors.push(`${url}: ${error instanceof Error ? error.message : "Ошибка загрузки"}`); }
    }
    snapshot.complete = errors.length === 0;
    if (errors.length) snapshot.error = `Не прочитано официальных акций: ${errors.length}. Исчезновение кодов не подтверждено. ${errors[0]}`;
  } catch (error) {
    snapshot.error = error instanceof Error ? error.message : "Официальный сайт недоступен";
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
    await browser?.close().catch(() => {});
  }
  return snapshot;
}
