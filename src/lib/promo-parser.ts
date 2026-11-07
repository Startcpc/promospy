import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { load } = require("cheerio") as typeof import("cheerio");
import { codeKey, getCompanyById, type PromoCode } from "./promocodes";
import { mergeOffers } from "./offer-identity";
import { merchantAliases } from "./merchant-aliases";
import { foreignMerchantHeading, explicitCode, validCouponToken } from "./promo-quality";

type RecordValue = Record<string, unknown>;
export type ParseDiagnostics={incomplete:boolean;reasons:string[];rejectedCodes?:string[]};
const CODE_FIELDS = ["promoCode", "promocode", "couponCode", "coupon_code", "promo_code", "discountCode", "promotionCode", "redeemCode"];
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
  const englishMonths=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const dayFirst=date.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})$/i);
  const monthFirst=date.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if(dayFirst||monthFirst){
    const name=(dayFirst?.[2]??monthFirst![1]).toLowerCase(),month=englishMonths.findIndex(item=>item===name||item.slice(0,3)===name);
    if(month<0)return undefined;
    date=String((dayFirst??monthFirst)![3])+'-'+String(month+1).padStart(2,'0')+'-'+String(dayFirst?.[1]??monthFirst![2]).padStart(2,'0');
  }
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
  const clock = date.match(/T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:Z|[+-]\d{2}:?\d{2})$/i);
  if (!clock || Number(clock[1]) > 24 || Number(clock[2]) > 59 || Number(clock[3] ?? 0) > 59) return undefined;
  if (Number(clock[1]) === 24 && (Number(clock[2]) !== 0 || Number(clock[3] ?? 0) !== 0 || /[1-9]/.test(clock[4] ?? ''))) return undefined;
  const calendar = date.slice(0, 10);
  const validation = new Date(`${calendar}T00:00:00Z`);
  if (!Number.isFinite(validation.getTime()) || validation.toISOString().slice(0, 10) !== calendar) return undefined;
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
function cleanText(value: string) {
  return load(`<div>${value}</div>`)("div").text().replace(/\s+/g, " ").trim().slice(0, 1500);
}
function recordToPromo(record: RecordValue, companyId: number, sourceUrl: string, now: number, requireMerchant = false, diagnostics?:ParseDiagnostics): PromoCode | undefined {
  const company = getCompanyById(companyId);
  const shop=record.shop??record.seller??record.merchant;
  const nestedShop = shop && typeof shop === "object" ? shop as RecordValue : undefined;
  const merchant = field(record, ["merchantName", "shopName", "storeName", "companyName"]) ?? (nestedShop ? field(nestedShop, ["title", "name"]) : undefined);
  if (requireMerchant && !merchant) return;
  if (merchant && company) {
    const normalized = merchant.toLocaleLowerCase("ru").replace(/[^\p{L}\p{N}]/gu, "");
    const aliases = [company.name, ...merchantAliases[companyId]??[]].map((name) => name.toLocaleLowerCase("ru").replace(/[^\p{L}\p{N}]/gu, ""));
    if (!aliases.includes(normalized)) return;
  }
  const rawCode = field(record, CODE_FIELDS) ?? (record["@type"] === "Offer" && typeof record.description === "string" ? explicitCode(record.description) : undefined);
  if (!rawCode) return;
  const code = codeKey(rawCode);
  if (!validCouponToken(code)) return;
  const description = cleanText(field(record, ["title", "description", "name"]) ?? `Промокод ${code}`);
  if (company && foreignMerchantHeading(description,companyId)) return;
  // Some aggregators attach sibling restaurants to the parent shop even in structured metadata.
  // Keep these source-specific exclusions explicit instead of asking an LLM to guess validity.
  if (companyId === 301 && /(?:твоя\s+пицца|(?:^|[^а-яё])[её]рш(?:$|[^а-яё]))/i.test(description)) return;
  const rawConditions = record.conditions ?? record.terms;
  const conditions = (Array.isArray(rawConditions) ? rawConditions : typeof rawConditions === "string" ? [rawConditions] : [])
    .filter((v): v is string => typeof v === "string").slice(0,20).map(cleanText).filter(Boolean);
  const details = field(record, ["description"]);
  if (details && cleanText(details) !== description) conditions.push(cleanText(details));
  if (record.forFirstPurchase === true && record.forRepeatPurchase === false) conditions.push("Только первый заказ");
  if (record.forRepeatPurchase === true && record.forFirstPurchase === false) conditions.push("Только повторный заказ");
  const percent = field(record, ["discountPercent", "discount_percent"]);
  const amount = field(record, ["discountAmount", "discount_amount"]);
  const discount = percent && Number(percent.replace(",", ".")) > 0 ? `−${percent}%`
    : amount && Number(amount) > 0 ? `${amount} ₽`
      : description.match(/\d+\s*%/)?.[0] ?? "По условиям акции";
  const conditionText = [description, ...conditions].join(" ");
  const minimum = field(record, ["minOrder", "minimumOrder", "min_order"])
    ?? conditionText.match(/(?:заказ[а-яё]*|покупк[а-яё]*|сумм[а-яё]*)(?:\s+на\s+сумму)?\s*(?:от|не\s+менее)\s*([\d\s\u00a0\u202f]+(?:[.,]\d{1,2})?)/i)?.[1];
  const rawEnd = field(record, ["expiresAt", "dateEnd", "endDate", "validThrough", "expirationDate"]);
  const rawStart = field(record, ["startsAt", "startDate", "validFrom"]);
  const expiresAt = parsePromoDate(rawEnd, true), startsAt = parsePromoDate(rawStart);
  if (rawEnd !== undefined && expiresAt === undefined || rawStart !== undefined && startsAt === undefined
    || startsAt !== undefined && expiresAt !== undefined && startsAt > expiresAt) {
    if(diagnostics){diagnostics.incomplete=true;diagnostics.rejectedCodes??=[];if(diagnostics.rejectedCodes.length<100)diagnostics.rejectedCodes.push(code);if(diagnostics.reasons.length<5)diagnostics.reasons.push('Неоднозначные или некорректные даты в записи промокода');}
    return;
  }
  return {
    id: `${companyId}:${code}`, companyId, code, description, discount,
    status: record.expired === true || /^(?:expired|ended|finished)$/i.test(field(record,["status","state"])??"") || expiresAt !== undefined && expiresAt <= now ? "expired" : "found",
    sources: [{ url: sourceUrl, name: new URL(sourceUrl).hostname, seenAt: now }],
    extraction: {method:"structured",text:[code,description,...conditions].join("\n").slice(0,3000)},
    appOnly: /(?:только|лишь|исключительно)\s+(?:в\s+)?(?:мобильном\s+)?приложении|app[- ]only/i.test(conditionText) || undefined,
    channel: /(?:только|лишь)\s+(?:в\s+)?(?:мобильном\s+)?приложении|app[- ]only/i.test(conditionText)?"app":/(?:только|лишь)\s+(?:в\s+)?магазин[а-яё]*|in[- ]store only/i.test(conditionText)?"in-store":/только\s+на\s+сайте|online only/i.test(conditionText)?"online":undefined,
    regions: Array.isArray(record.regions)?record.regions.filter((value):value is string=>typeof value==="string").slice(0,20).map(value=>cleanText(value).slice(0,200)):undefined,
    categories: Array.isArray(record.eligibleCategories)?record.eligibleCategories.filter((value):value is string=>typeof value==="string").slice(0,20).map(value=>cleanText(value).slice(0,200)):undefined,
    maxDiscount: (()=>{const value=field(record,["maxDiscount","maximumDiscount"])??conditionText.match(/максимальн[а-яё]*\s+скидк[а-яё]*\s*[:—-]?\s*(\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:₽|руб)/i)?.[1];return value?parseMoney(value):undefined;})(),
    found: now, conditions, minOrder: minimum ? parseMoney(minimum) : undefined, startsAt, expiresAt,
  };
}
/** Parse complete objects, never a character window containing adjacent offers. */
export function parsePromoCodesFromHtml(html: string, sourceUrl: string, companyId = 0, now = Date.now(), options: {requireMerchant?:boolean;diagnostics?:ParseDiagnostics} = {}): PromoCode[] {
  const $ = load(html);
  const records: RecordValue[] = [];
  const visit = (value: unknown, depth = 0, inheritedMerchant?: string) => {
    if (depth > 30 || records.length >= MAX_RECORDS || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1, inheritedMerchant)); return; }
    const record = value as RecordValue;
    const owner=record.shop??record.seller??record.merchant;
    const merchant=field(record,["merchantName","shopName","storeName","companyName"])??(owner&&typeof owner==="object"?field(owner as RecordValue,["title","name"]):undefined)??inheritedMerchant;
    const identifier=record.identifier && typeof record.identifier==="object" ? record.identifier as RecordValue : undefined;
    const namedIdentifier=identifier && /^(?:promoCode|couponCode|promo_code|discountCode)$/i.test(String(identifier.propertyID??identifier.name??"")) && typeof identifier.value==="string" ? identifier.value : undefined;
    const candidate={...record,...(merchant?{merchantName:merchant}:{}),...(namedIdentifier?{promoCode:namedIdentifier}:{})};
    if (CODE_FIELDS.some((key) => (typeof candidate[key] === "string" || typeof candidate[key] === "number" && Number.isFinite(candidate[key]))) || record["@type"]==="Offer"&&typeof record.description==="string"&&explicitCode(record.description)) records.push(candidate);
    Object.entries(record).filter(([key])=>!/(?:related|recommend|similar|other_?(?:shops|stores|merchants))/i.test(key)&&!/^(?:session|auth|account|userProfile|personalData|csrf|accessToken|credentials|cart|basket)$/i.test(key)).forEach(([,item]) => visit(item, depth + 1, merchant));
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
        if (/"(?:promoCode|promocode|couponCode|coupon_code|promo_code|discountCode|promotionCode|redeemCode)"\s*:/.test(candidate)) {
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
    if(el.parents("template,[hidden],[aria-hidden=\"true\"],[style*=\"display:none\"],[style*=\"display: none\"]").length)return;
    const card = el.closest("[data-coupon], [data-offer], .coupon, .promocode, .offer");
    records.push({
      promoCode: el.attr("data-promocode") ?? el.attr("data-promo-code") ?? el.attr("data-coupon-code"),
      title: card.find("[data-title], h2, h3, .coupon-title").first().text() || el.attr("data-title"),
      conditions: card.find("[data-conditions], .conditions").first().text(),
      expiresAt: el.attr("data-expires-at") ?? card.attr("data-expires-at"),
    });
  });
  return mergePromoCodes(records.map((record) => recordToPromo(record, companyId, sourceUrl, now, options.requireMerchant, options.diagnostics)).filter((code): code is PromoCode => !!code));
}
export function mergePromoCodes(codes: PromoCode[]): PromoCode[] {
  return mergeOffers(codes);
}
