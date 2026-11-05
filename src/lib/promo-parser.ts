import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { load } = require("cheerio") as typeof import("cheerio");
import { codeKey, getCompanyById, type PromoCode } from "./promocodes";

type RecordValue = Record<string, unknown>;
const CODE_FIELDS = ["promoCode", "promocode", "couponCode", "coupon_code", "promo_code"];
const MAX_RECORDS = 1000;
function field(record: RecordValue, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
}
export function parseMoney(text: string): number | undefined {
  const match = text.match(/\d[\d\s\u00a0\u202f]*(?:[.,]\d{1,2})?/);
  if (!match) return undefined;
  const value = Number(match[0].replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}
// Date-only values mean a Moscow calendar day, independently of server timezone.
export function parsePromoDate(value: unknown, endOfDay = false): number | undefined {
  if (typeof value === "number" || (typeof value === "string" && /^\d{10}(?:\d{3})?$/.test(value))) {
    const raw = Number(value);
    const timestamp = raw < 100_000_000_000 ? raw * 1000 : raw;
    return Number.isFinite(timestamp) && timestamp >= 946684800000 && timestamp < 4102444800000 ? timestamp : undefined;
  }
  if (typeof value !== "string") return undefined;
  let date = value.trim();
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const written = date.toLocaleLowerCase("ru").match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{4})(?:\s*г(?:ода|\.)?)?$/);
  if (written) {
    const month = months.indexOf(written[2]) + 1;
    if (!month) return undefined;
    date = `${written[3]}-${String(month).padStart(2, "0")}-${written[1].padStart(2, "0")}`;
  }
  const ru = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ru) date = `${ru[3]}-${ru[2].padStart(2, "0")}-${ru[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const validation = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(validation.getTime()) || validation.toISOString().slice(0, 10) !== date) return undefined;
    date += endOfDay ? "T23:59:59.999+03:00" : "T00:00:00+03:00";
  }
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(date)) return undefined;
  const calendar = date.slice(0, 10);
  const validation = new Date(`${calendar}T00:00:00Z`);
  if (!Number.isFinite(validation.getTime()) || validation.toISOString().slice(0, 10) !== calendar) return undefined;
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
function cleanText(value: string) {
  return load(`<div>${value}</div>`)("div").text().replace(/\s+/g, " ").trim().slice(0, 1500);
}
function recordToPromo(record: RecordValue, companyId: number, sourceUrl: string, now: number): PromoCode | undefined {
  const company = getCompanyById(companyId);
  const nestedShop = record.shop && typeof record.shop === "object" ? record.shop as RecordValue : undefined;
  const merchant = field(record, ["merchantName", "shopName", "storeName", "companyName"]) ?? (nestedShop ? field(nestedShop, ["title", "name"]) : undefined);
  if (merchant && company) {
    const normalized = merchant.toLocaleLowerCase("ru").replace(/[^\p{L}\p{N}]/gu, "");
    const aliases = [company.name, ...company.keywords].map((name) => name.toLocaleLowerCase("ru").replace(/[^\p{L}\p{N}]/gu, ""));
    if (!aliases.includes(normalized)) return;
  }
  const rawCode = field(record, CODE_FIELDS);
  if (!rawCode) return;
  const code = codeKey(rawCode);
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]{1,63}$/u.test(code)) return;
  const description = cleanText(field(record, ["title", "description", "name"]) ?? `Промокод ${code}`);
  // Some aggregators attach sibling restaurants to the parent shop even in structured metadata.
  // Keep these source-specific exclusions explicit instead of asking an LLM to guess validity.
  if (companyId === 301 && /(?:твоя\s+пицца|(?:^|[^а-яё])[её]рш(?:$|[^а-яё]))/i.test(description)) return;
  const rawConditions = record.conditions ?? record.terms;
  const conditions = (Array.isArray(rawConditions) ? rawConditions : typeof rawConditions === "string" ? [rawConditions] : [])
    .filter((v): v is string => typeof v === "string").map(cleanText).filter(Boolean);
  const details = field(record, ["description"]);
  if (details && cleanText(details) !== description) conditions.push(cleanText(details));
  if (record.forFirstPurchase === true && record.forRepeatPurchase === false) conditions.push("Только первый заказ");
  if (record.forRepeatPurchase === true && record.forFirstPurchase === false) conditions.push("Только повторный заказ");
  const percent = field(record, ["discountPercent", "discount_percent"]);
  const amount = field(record, ["discountAmount", "discount_amount"]);
  const discount = percent && Number(percent) > 0 ? `−${percent}%`
    : amount && Number(amount) > 0 ? `${amount} ₽`
      : description.match(/\d+\s*%/)?.[0] ?? "По условиям акции";
  const conditionText = [description, ...conditions].join(" ");
  const minimum = field(record, ["minOrder", "minimumOrder", "min_order"])
    ?? conditionText.match(/(?:заказ[а-яё]*|покупк[а-яё]*|сумм[а-яё]*)(?:\s+на\s+сумму)?\s*(?:от|не\s+менее)\s*([\d\s\u00a0\u202f]+(?:[.,]\d{1,2})?)/i)?.[1];
  const expiresAt = parsePromoDate(field(record, ["expiresAt", "dateEnd", "endDate", "validThrough", "expirationDate"]), true);
  const startsAt = parsePromoDate(field(record, ["startsAt", "startDate", "validFrom"]));
  return {
    id: `${companyId}:${code}`, companyId, code, description, discount,
    status: expiresAt !== undefined && expiresAt <= now ? "expired" : "found",
    sources: [{ url: sourceUrl, name: new URL(sourceUrl).hostname, seenAt: now }],
    found: now, conditions, minOrder: minimum ? parseMoney(minimum) : undefined, startsAt, expiresAt,
  };
}
/** Parse complete objects, never a character window containing adjacent offers. */
export function parsePromoCodesFromHtml(html: string, sourceUrl: string, companyId = 0, now = Date.now()): PromoCode[] {
  const $ = load(html);
  const records: RecordValue[] = [];
  const visit = (value: unknown, depth = 0) => {
    if (depth > 30 || records.length >= MAX_RECORDS || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return; }
    const record = value as RecordValue;
    if (CODE_FIELDS.some((key) => typeof record[key] === "string")) records.push(record);
    Object.values(record).forEach((item) => visit(item, depth + 1));
  };
  const parseJson = (text: string) => {
    try { visit(JSON.parse(text)); return; } catch { /* JS assignments need balanced object slices. */ }
    const stack: number[] = [];
    let quoted = false, escaped = false;
    for (let i = 0; i < text.length && records.length < MAX_RECORDS; i++) {
      const c = text[i];
      if (quoted) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') quoted = false; continue; }
      if (c === '"') { quoted = true; continue; }
      if (c === "{") stack.push(i);
      if (c === "}" && stack.length) {
        const start = stack.pop()!;
        if (i - start > 50000) continue;
        const candidate = text.slice(start, i + 1);
        if (/"(?:promoCode|promocode|couponCode|coupon_code|promo_code)"\s*:/.test(candidate)) {
          try { visit(JSON.parse(candidate)); } catch { /* Ignore malformed data. */ }
        }
      }
    }
  };
  const scripts = $("script");
  if (scripts.length) scripts.each((_, element) => { parseJson($(element).html() ?? ""); });
  else parseJson(html);
  // Explicit attributes only: do not guess codes from arbitrary uppercase text.
  $("[data-promocode], [data-promo-code], [data-coupon-code]").each((_, element) => {
    if (records.length >= MAX_RECORDS) return;
    const el = $(element);
    const card = el.closest("[data-coupon], [data-offer], .coupon, .promocode, .offer");
    records.push({
      promoCode: el.attr("data-promocode") ?? el.attr("data-promo-code") ?? el.attr("data-coupon-code"),
      title: card.find("[data-title], h2, h3, .coupon-title").first().text() || el.attr("data-title"),
      conditions: card.find("[data-conditions], .conditions").first().text(),
      expiresAt: el.attr("data-expires-at") ?? card.attr("data-expires-at"),
    });
  });
  return mergePromoCodes(records.map((record) => recordToPromo(record, companyId, sourceUrl, now)).filter((code): code is PromoCode => !!code));
}
export function mergePromoCodes(codes: PromoCode[]): PromoCode[] {
  const unique = new Map<string, PromoCode>();
  for (const code of codes) {
    const key = `${code.companyId}:${codeKey(code.code)}`;
    const existing = unique.get(key);
    if (!existing) { unique.set(key, { ...code, sources: [...code.sources] }); continue; }
    for (const source of code.sources) if (!existing.sources.some((s) => s.url === source.url)) existing.sources.push(source);
    // Keep the preferred source's conditions and dates together; don't splice conflicting offers.
  }
  return [...unique.values()];
}
