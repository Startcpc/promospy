import type { Company } from "./companies";
import { makeLogEntry, type PromoCode, type ScanLogEntry } from "./promocodes";
import { mergePromoCodes, parsePromoCodesFromHtml } from "./promo-parser";
import { verifyPromoWithBrowser } from "./promo-verification";
import { collectTanukiOfficial, type OfficialSnapshot } from "./tanuki-official";
import { collectPublicOfficial, PUBLIC_OFFICIAL_URLS } from "./public-official";
export { parsePromoCodesFromHtml } from "./promo-parser";
export { verifyPromoWithBrowser } from "./promo-verification";

export const COMPANY_SLUGS: Record<number, string> = {
  5: "burger-king", 54: "vkusvill", 102: "vkusno-i-tochka", 201: "magnit", 202: "pyaterochka",
  203: "yandex-lavka", 204: "yandex-market", 205: "perekrestok", 206: "lenta", 207: "wildberries", 208: "ozon", 301: "tanuki",
};
const AGGREGATORS = [
  { host: "promokod.pikabu.ru", url: (slug: string) => `https://promokod.pikabu.ru/shops/${slug}` },
  { host: "promokodi.ru", url: (slug: string) => `https://promokodi.ru/store/${slug}` },
  { host: "promokod.vbr.ru", url: (slug: string) => `https://promokod.vbr.ru/shops/${slug}` },
  { host: "www.promkod.ru", url: (slug: string) => `https://www.promkod.ru/shop/${slug}.ru` },
  { host: "promokodus.com", url: (slug: string) => `https://promokodus.com/campaigns/${slug}` },
];
export function allowedSource(url: string, company: Company): boolean {
  try {
    const parsed = new URL(url);
    const hosts = [...AGGREGATORS.map((item) => item.host), new URL(company.website).hostname,
      ...(company.id === 301 ? ["tanukifamily.ru", "tanuki.ru"] : [])];
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port
      && hosts.some((host) => parsed.hostname.replace(/^www\./, "") === host.replace(/^www\./, ""));
  } catch { return false; }
}
async function boundedDiscovery(operation: () => Promise<unknown>, signal?: AbortSignal) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    signal?.throwIfAborted();
    return await Promise.race([operation(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("search timeout")), 10000);
      onAbort = () => reject(new Error("search aborted"));
      signal?.addEventListener("abort", onAbort, { once: true });
    })]);
  } finally {
    clearTimeout(timer);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  }
}
export async function findPromoSources(company: Company, signal?: AbortSignal): Promise<string[]> {
  const slug = COMPANY_SLUGS[company.id];
  // Official site first. Search discoveries are additive; do not discard all but the first one.
  const sources = [company.website, ...AGGREGATORS.map((item) => item.url(slug))];
  if (process.env.PROMO_WEB_SEARCH_ENABLED === "1") {
    try {
      const result = await boundedDiscovery(async () => {
        const ZAI = (await import("z-ai-web-dev-sdk")).default;
        const zai = await ZAI.create();
        signal?.throwIfAborted();
        const search = (zai as unknown as { functions?: { invoke: (name: string, args: object) => Promise<unknown> } }).functions;
        return search?.invoke("web_search", { query: `${company.name} промокоды ${new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}`, num: 6 });
      }, signal);
      if (Array.isArray(result)) for (const item of result) {
        if (typeof item?.url === "string" && allowedSource(item.url, company)) sources.push(item.url);
      }
    } catch { /* Known sources still work without SDK credentials. */ }
  }
  return [...new Set(sources)].slice(0, 12);
}

async function downloadSource(url: string, company: Company, signal: AbortSignal): Promise<string> {
  // Redirects are checked individually: discovery must not turn into arbitrary server-side requests.
  for (let redirect = 0; redirect < 4; redirect++) {
    if (!allowedSource(url, company)) throw new Error("Недопустимый адрес источника");
    const response = await fetch(url, { signal, redirect: "manual", headers: { "User-Agent": "PromoSpy/0.3 (+coupon indexing)", "Accept-Language": "ru-RU", Accept: "text/html,application/json" } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Перенаправление без адреса");
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Пустой ответ");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 4_000_000) throw new Error("Страница превышает лимит размера");
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("Слишком много перенаправлений");
}

export type ScanResult = { codes: PromoCode[]; sourcesSucceeded: number; sourcesTotal: number; official?: OfficialSnapshot };
export async function runFullScan(
  company: Company,
  onProgress: (entry: ScanLogEntry) => void,
  signal: AbortSignal,
  previous: PromoCode[] = [],
): Promise<ScanResult> {
  if (PUBLIC_OFFICIAL_URLS[company.id]) {
    onProgress(makeLogEntry(`Читаю официальные промокоды ${company.name} без входа в аккаунт`, "scan"));
    const official = await collectPublicOfficial(company.id, signal);
    signal.throwIfAborted();
    onProgress(makeLogEntry(official.error ?? `Официальный сайт: найдено ${official.codes.length} кодов`, official.error ? "error" : "found"));
    return { codes: official.codes, sourcesSucceeded: official.complete ? 1 : 0, sourcesTotal: 1, official };
  }
  const sources = await findPromoSources(company, signal);
  const collected: PromoCode[] = [];
  let sourcesSucceeded = 0;
  let official: OfficialSnapshot | undefined;
  if (company.id === 301) {
    onProgress(makeLogEntry("Читаю официальные акции Тануки: Москва, без входа в аккаунт", "scan"));
    official = await collectTanukiOfficial(signal);
    collected.push(...official.codes);
    if (official.complete || official.codes.length) sourcesSucceeded++;
    onProgress(makeLogEntry(official.error ?? `Официальный сайт: найдено ${official.codes.length} кодов`, official.error ? "error" : "found"));
  }
  for (const url of sources) {
    if (company.id === 301 && new URL(url).hostname.replace(/^www\./, "") === "tanukifamily.ru") continue;
    signal.throwIfAborted();
    const host = new URL(url).hostname;
    onProgress(makeLogEntry(`Читаю ${host}`, "scan"));
    try {
      const html = await downloadSource(url, company, AbortSignal.any([signal, AbortSignal.timeout(12000)]));
      // A challenge page is not a successful scan with zero offers.
      if (/captcha|cf-chl-|проверка браузера|подтвердите.{0,25}не робот/i.test(html.slice(0, 15000))) throw new Error("Источник требует ручной проверки");
      const codes = parsePromoCodesFromHtml(html, url, company.id);
      collected.push(...codes);
      sourcesSucceeded++;
      onProgress(makeLogEntry(`${host}: найдено ${codes.length}`, "found"));
    } catch (error) {
      onProgress(makeLogEntry(`${host}: ${error instanceof Error ? error.message.slice(0, 150) : "недоступен"}`, "error"));
    }
  }
  signal.throwIfAborted();
  if (!sourcesSucceeded) throw new Error("Источники недоступны. Сохранённые промокоды остаются в каталоге.");
  const codes = mergePromoCodes(collected).slice(0, 200);
  const lastChecked = new Map(previous.map((code) => [code.code, code.checked ?? 0]));
  const officialKnown = new Set(previous.filter((code) => code.evidence?.method === "source").map((code) => code.code));
  const candidates = codes.filter((code) => code.status !== "expired" && code.status !== "official" && !officialKnown.has(code.code))
    .sort((a, b) => (lastChecked.get(a.code) ?? 0) - (lastChecked.get(b.code) ?? 0));
  // Rotate checks across scans rather than checking the same first five forever.
  for (const code of candidates.slice(0, 5)) {
    signal.throwIfAborted();
    onProgress(makeLogEntry(`Проверяю ${code.code} в тестовой корзине`, "verify"));
    const result = await verifyPromoWithBrowser(code, company, signal);
    signal.throwIfAborted();
    code.status = result.status;
    code.checked = Date.now();
    code.verificationDetails = result.details;
    code.evidence = result.evidence;
    code.validUntil = result.status === "verified" ? Math.min(Date.now() + 6 * 60 * 60 * 1000, code.expiresAt ?? Infinity) : undefined;
    onProgress(makeLogEntry(`${code.code}: ${result.details}`, "result"));
  }
  return { codes, sourcesSucceeded, sourcesTotal: sources.length, official };
}
