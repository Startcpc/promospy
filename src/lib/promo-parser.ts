import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { load } = require("cheerio") as typeof import("cheerio");
import { codeKey, getCompanyById, type PromoCode } from "./promocodes";
import { mergeOffers } from "./offer-identity";
import { merchantAliases, normalizeMerchantName } from "./merchant-aliases";
import { parsePromoDate } from "./promo-date";
export { parsePromoDate } from "./promo-date";
import { extractOfficialDates } from "./promo-terms";
import { foreignMerchantHeading, explicitCode, validCouponToken } from "./promo-quality";

type RecordValue = Record<string, unknown>;
export type ParseDiagnostics={incomplete:boolean;reasons:string[];rejectedCodes?:string[]};
const CODE_FIELDS = ["promoCode", "promocode", "couponCode", "coupon_code", "promo_code", "discountCode", "promotionCode", "redeemCode"];
const MAX_RECORDS = 1000;
const privateRecord=(record:RecordValue)=>record.requiresLogin===true||record.requiresRegistration===true||record.isPremium===true||record.locked===true||record.public===false;
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
function cleanText(value: string) {
  return load(`<div>${value}</div>`)("div").text().replace(/\s+/g, " ").trim().slice(0, 1500);
}
function maximumDiscount(record:RecordValue,terms:string){
  const explicit=field(record,['maxDiscount','maximumDiscount']);
  if(explicit!==undefined)return parseMoney(explicit);
  const pattern=/(?:максимальн[а-яё]*\s+(?:сумм[а-яё]*\s+)?скидк[а-яё]*|максимум)\s*[:−–—-]?\s*(\d[\d\s\u00a0\u202f]*(?:[.,]\d{1,2})?)\s*(?:₽|руб)/gi;
  const limits=[...new Set([...terms.matchAll(pattern)].map(match=>parseMoney(match[1])).filter((value):value is number=>value!==undefined))];
  // Different limits can be scoped to different services in the same offer.
  // Keep that prose intact instead of choosing a misleading universal number.
  return limits.length===1?limits[0]:undefined;
}
function recordToPromo(record: RecordValue, companyId: number, sourceUrl: string, now: number, requireMerchant = false, diagnostics?:ParseDiagnostics): PromoCode | undefined {
  if(privateRecord(record))return;
  const company = getCompanyById(companyId);
  const shop=record.shop??record.seller??record.merchant;
  const nestedShop = shop && typeof shop === "object" ? shop as RecordValue : undefined;
  const merchant = field(record, ["merchantName", "shopName", "storeName", "companyName"]) ?? (nestedShop ? field(nestedShop, ["title", "name"]) : undefined);
  if (requireMerchant && !merchant) return;
  if (merchant && company) {
    const normalized = normalizeMerchantName(merchant);
    const aliases = [company.name, ...merchantAliases[companyId]??[]].map(normalizeMerchantName);
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
  let written: {startsAt?:number;expiresAt?:number};
  try {written=extractOfficialDates(conditionText);} catch {
    if(diagnostics){diagnostics.incomplete=true;diagnostics.rejectedCodes??=[];if(diagnostics.rejectedCodes.length<100)diagnostics.rejectedCodes.push(code);if(diagnostics.reasons.length<5)diagnostics.reasons.push('Не распознаны сроки в условиях промокода');}
    return;
  }
  const expiresAt = rawEnd===undefined?written.expiresAt:parsePromoDate(rawEnd, true), startsAt = rawStart===undefined?written.startsAt:parsePromoDate(rawStart);
  if (rawEnd !== undefined && expiresAt === undefined || rawStart !== undefined && startsAt === undefined
    || rawEnd !== undefined && written.expiresAt !== undefined && expiresAt !== written.expiresAt
    || rawStart !== undefined && written.startsAt !== undefined && startsAt !== written.startsAt
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
    maxDiscount: maximumDiscount(record,conditionText),
    found: now, conditions, minOrder: minimum ? parseMoney(minimum) : undefined, startsAt, expiresAt,
  };
}
/** Parse complete objects, never a character window containing adjacent offers. */
export function parsePromoCodesFromHtml(html: string, sourceUrl: string, companyId = 0, now = Date.now(), options: {requireMerchant?:boolean;diagnostics?:ParseDiagnostics} = {}): PromoCode[] {
  const $ = load(html);
  $('template,[hidden],[aria-hidden="true"],[style*="display:none"],[style*="display: none"]').remove();
  const records: RecordValue[] = [];
  const visit = (value: unknown, depth = 0, inheritedMerchant?: string) => {
    if (depth > 30 || records.length >= MAX_RECORDS || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1, inheritedMerchant)); return; }
    const record = value as RecordValue;
    if(privateRecord(record))return;
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
    // Parse the outer valid JSON object first. Extracting inner objects first
    // drops the merchant owner and can bypass excluded session/account branches.
    type Slice={start:number;end:number;children:Slice[]};
    const roots:Slice[]=[],stack:Slice[]=[];
    let quoted = false, escaped = false;
    let objects=0;
    for (let i = 0; i < text.length && objects<5000; i++) {
      const c = text[i];
      if (quoted) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') quoted = false; continue; }
      if (c === '"') { quoted = true; continue; }
      if (c === "{") {const slice={start:i,end:0,children:[]};(stack.length?stack[stack.length-1].children:roots).push(slice);stack.push(slice);objects++;}
      if (c === "}" && stack.length) {
        stack.pop()!.end=i+1;
      }
    }
    const parseSlice=(slice:Slice,depth=0)=>{
      if(depth>30||records.length>=MAX_RECORDS)return;
      if(slice.end)try{visit(JSON.parse(text.slice(slice.start,slice.end)));return;}catch{}
      slice.children.forEach(child=>parseSlice(child,depth+1));
    };
    roots.forEach(slice=>parseSlice(slice));
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
