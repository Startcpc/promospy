import { createRequire } from "node:module";
import { ALLO_ID, EDO_ID, FOX_ID, METRO_ID } from "./companies";
import { mergePromoCodes, parsePromoCodesFromHtml, parseMoney } from "./promo-parser";
import { validCouponToken, validMerchantCouponToken } from "./promo-quality";
import { extractOfficialDates } from "./promo-terms";
import type { PromoCode } from "./promocodes";
const { load } = createRequire(import.meta.url)("cheerio") as typeof import("cheerio");

export const PUBLIC_OFFICIAL_URLS: Record<number, string> = {
  54: "https://vkusvill.ru/promocodes/",
  201: "https://promo.magnit.ru/",
  [METRO_ID]: "https://online.metro-cc.ru/promo/promocode/",
  [EDO_ID]: "https://edosushi.ru/offers",
  [FOX_ID]: "https://fox-pizza.ru/promotions",
  [ALLO_ID]: "https://allopizza.su/actions",
};
export function hasPublicOfficialMarkup(companyId: number, html: string) {
  const $ = load(html);
  if (companyId === 54) return $('.js-vv21-promocode-item').length > 0;
  if (companyId === 201) return $('.t396__artboard').filter((_, board) => /промокод/i.test($(board).text())).length > 0;
  return false;
}
const text = (value: string) => value.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
function officialCode(
  companyId: number, code: string, discount: string | undefined, conditions: string[], now: number,
  title = discount ? `${discount}: ${conditions[0]}` : conditions[0],
  sourceUrl = PUBLIC_OFFICIAL_URLS[companyId],
): PromoCode {
  if (!validMerchantCouponToken(code, companyId)) throw new Error("Изменился формат официального кода");
  const terms = conditions.join(" ");
  const { expiresAt, startsAt } = extractOfficialDates(terms);
  const [offer] = parsePromoCodesFromHtml(JSON.stringify([{ promoCode: code, title,
    expiresAt, startsAt,
    conditions, discountPercent: discount?.match(/(\d+(?:[.,]\d+)?)\s*%/)?.[1]?.replace(",", "."),
    discountAmount: discount && !discount.includes("%") ? parseMoney(discount) : undefined }]), sourceUrl, companyId, now);
  if (!offer) throw new Error("Не распознана официальная карточка");
  return { ...offer, status: offer.status === "expired" ? "expired" : "official", checked: now,
    verificationDetails: "Код опубликован на официальном сайте. Применение в корзине не проверялось.",
    evidence: { method: "source", observedAt: now, sourceUrl, message: offer.description } };
}

function parseMetro(html: string, now: number): PromoCode[] {
  const $ = load(html);
  const section = $("section.body-section").filter((_, item) =>
    text($(item).find("h2").first().text()) === "Правила применения промокодов");
  const cards = section.children(".wp-block-columns").children(".wp-block-column").has("> h3");
  if (section.length !== 1 || !cards.length || cards.length > 100) {
    throw new Error("Не распознан список промокодов METRO");
  }

  return cards.map((_, item) => {
    const card = $(item);
    const code = text(card.children("h3").text());
    const conditions = card.children("p").map((_, paragraph) => text($(paragraph).text())).get().filter(Boolean);
    const terms = conditions.join(" ");
    const statedCode = terms.match(/промокод(?:у)?\s+(?:«([^»]+)»|([^\s.,;!?]+))/i);
    const discount = terms.match(/(?:скидку|акция)\s+(\d+(?:[.,]\d+)?\s*%)/i)?.[1];
    if (!validCouponToken(code) || code !== (statedCode?.[1] ?? statedCode?.[2]) || !discount) {
      throw new Error("Не удалось связать код METRO со скидкой и условиями");
    }
    const description = terms.split(/(?<=[.!?])\s+/)[0];
    return officialCode(METRO_ID, code, discount, conditions, now, description);
  }).get();
}

function parseEdo(html: string, now: number): PromoCode[] {
  // Read the data embedded in the public page that renders the promotion cards.
  const $ = load(html);
  const payload = $('script#vike_pageContext[type="application/json"]').text();
  const page = JSON.parse(payload) as {urlPathname?: string; initialStoreState?: {promo?: {all?: unknown}}};
  const promotions = page.initialStoreState?.promo?.all;
  if (page.urlPathname !== "/offers" || !Array.isArray(promotions) || promotions.length > 100) {
    throw new Error("Не распознан список акций ЁДО Суши");
  }

  const codes: PromoCode[] = [];
  for (const promotion of promotions) {
    if (typeof promotion?.name !== "string" || typeof promotion.description !== "string") {
      throw new Error("Неполная карточка акции ЁДО Суши");
    }
    const conditions = promotion.description.split(/\r?\n/).map(text).filter(Boolean) as string[];
    const terms = conditions.join(" ");
    const headingCode = promotion.name.match(/^промокод\s+#([^\s]+)\s*$/i)?.[1];
    const statedCodes = [...terms.matchAll(/(?:по\s+промокоду|(?:вводи|напишите|поле)\s+промокод)\s+(?:«([^»]+)»|([^\s«»]+))/giu)]
      .map(match => match[1] ?? match[2].replace(/[.,;!?]$/u, ""))
      .filter(code => validCouponToken(code) && (code === headingCode || /^[\p{Lu}\d_-]+$/u.test(code)));
    const unique = new Set(statedCodes);
    if (!headingCode && !unique.size) continue;
    if (unique.size !== 1 || (headingCode && !unique.has(headingCode))) {
      throw new Error("Не удалось связать промокод ЁДО Суши с условиями");
    }
    codes.push(officialCode(EDO_ID, statedCodes[0], undefined, conditions, now));
  }
  if (!codes.length) throw new Error("В карточках ЁДО Суши не распознаны промокоды");
  return codes;
}

function readPublishedCodes(conditions: string[], companyId: number): string[] {
  const tokens = new Set<string>();
  for (const term of conditions) {
    const matches = term.matchAll(/(?:по\s+промокоду|(?:вводи|введи|введите|ввести|используй|используйте)\s+промокод)\s*[:：]?\s+(?:«([^»]+)»|"([^"]+)"|([^\s"«»]+))/giu);
    for (const [, angled, quoted, unquoted] of matches) {
      const candidate = angled ?? quoted ?? unquoted.replace(/[.,!:;?)]+(?:\p{Extended_Pictographic}|\uFE0F)*$/u, "");
      if (!validMerchantCouponToken(candidate, companyId)) continue;
      if (angled !== undefined || quoted !== undefined || /^[\p{Lu}\d_-]+$/u.test(candidate)) tokens.add(candidate);
    }
  }
  return [...tokens];
}

function readDiscount(value: string) {
  return value.match(/(?:скидк[ауи]|дарим|получай)\s*[-−–]?\s*(\d+(?:[.,]\d+)?\s*%)/iu)?.[1]
    ?? value.match(/^\s*[-−–]?\s*(\d+(?:[.,]\d+)?\s*%)\s+на\s/iu)?.[1];
}

function parseFox(html: string, now: number): PromoCode[] {
  const $ = load(html);
  const cards = $("div:has(> img[alt]):has(> h2)").filter((_, item) => {
    const card = $(item);
    return text(card.children("img").first().attr("alt") ?? "") === text(card.children("h2").text());
  });
  if (!/акции пиццерии fox pizza/i.test($("title").text()) || !cards.length || cards.length > 100) {
    throw new Error("Не распознан список акций Fox Pizza");
  }

  const offers: PromoCode[] = [];
  for (const item of cards) {
    const card = $(item);
    const title = text(card.children("h2").text());
    const conditions = card.find("p,li").map((_, element) => text($(element).text())).get().filter(Boolean);
    const codes = readPublishedCodes(conditions, FOX_ID);
    if (!codes.length && !/^промокод\s/i.test(title)) continue;
    if (codes.length !== 1) throw new Error("Не удалось связать промокод Fox Pizza с условиями");
    offers.push(officialCode(FOX_ID, codes[0], readDiscount(conditions.join(" ")), conditions, now, title));
  }
  return offers;
}

export function isAlloPromotionDetail(url: string) {
  const target = new URL(url);
  return target.origin === "https://allopizza.su" && !target.search && /^\/action\/[a-z0-9-]+\/?$/.test(target.pathname);
}

export function alloPromotionUrls(html: string) {
  const $ = load(html);
  const links = $("main .v-actions .v-card-flex > a[href]").map((_, element) => {
    const path = $(element).attr("href") ?? "";
    return /^\/action\/[a-z0-9-]+\/?$/.test(path) ? new URL(path, PUBLIC_OFFICIAL_URLS[ALLO_ID]).href : undefined;
  }).get();
  if (!$("main h1").text().includes("Акции ресторана") || !links.length) {
    throw new Error("Не распознан список акций «Алло! Пицца»");
  }
  return [...new Set(links)];
}

function parseAllo(html: string, url: string, now: number): PromoCode[] {
  const $ = load(html);
  const card = $("main .v-action-single__body");
  const title = text(card.children("h1").text());
  const description = card.children(".v-action-single__description");
  if (card.length !== 1 || !title || !text(description.text())) {
    throw new Error("Не распознаны условия «Алло! Пицца»");
  }

  const teaser = text(card.children(".v-action-single__teaser").text());
  const content = description.find("p,li,h2,h3,h4").map((_, element) => text($(element).text())).get();
  const conditions = [...new Set([teaser, ...content].filter(Boolean))];
  if (!conditions.length) conditions.push(text(description.text()));
  const codes = readPublishedCodes(conditions, ALLO_ID);
  if (!codes.length) return [];
  if (codes.length !== 1) throw new Error("Не удалось связать промокод «Алло! Пицца» с условиями");
  const discount = readDiscount(title) ?? readDiscount(conditions.join(" "));
  const offer = officialCode(ALLO_ID, codes[0], discount, conditions, now, title, url);
  const terms = conditions.join(" ");
  const minimums = new Set([...terms.matchAll(/минимальная сумма (?:заказа|корзины)(?: для применения промокода)?\s*[—–:-]?\s*(\d[\d ]*)\s*(?:₽|руб|р\b)/giu)]
    .map(match => parseMoney(match[1])).filter(value => value !== undefined));
  if (minimums.size === 1 && !/без ограничений по сумме/i.test(terms)) offer.minOrder = [...minimums][0];
  return [offer];
}

/** Structure-specific parsers: never associate codes with terms from a neighbouring card. */
export function parsePublicOfficial(companyId: number, html: string, now = Date.now(), url = PUBLIC_OFFICIAL_URLS[companyId]): PromoCode[] {
  if (companyId === METRO_ID) return mergePromoCodes(parseMetro(html, now));
  if (companyId === EDO_ID) return mergePromoCodes(parseEdo(html, now));
  if (companyId === FOX_ID) return mergePromoCodes(parseFox(html, now));
  if (companyId === ALLO_ID) {
    if (isAlloPromotionDetail(url)) return parseAllo(html, url, now);
    alloPromotionUrls(html);
    return [];
  }
  const $ = load(html);
  $("script,style,noscript").remove();
  const codes: PromoCode[] = [];
  if (companyId === 54) {
    if (!/промокоды\s+вкус\s*вилл/i.test(text($("h1").text()))) throw new Error("Не распознана страница промокодов ВкусВилл");
    const cards = $(".js-vv21-promocode-item");
    if (!cards.length || cards.length > 100) throw new Error("Не распознан список промокодов ВкусВилл");
    cards.each((_, element) => {
      const card = $(element);
      const code = text(card.find(".js-vv21-promocode-item__code").text());
      const button = text(card.find(".js-vv21-promocode-item__btn").text());
      const discount = text(card.find(".VV21_PromocodesCode__Title").text());
      const terms = [...new Set(card.find(".subtitle").not(".js-vv21-promocode-item__text-success").map((_, e) => text($(e).text())).get().filter(Boolean))];
      const buttonIsCode = /^[\p{L}\p{N}][\p{L}\p{N}_-]{1,63}$/u.test(button) && !/^(скопировать|копировать|copy)$/i.test(button);
      if (!code || buttonIsCode && code !== button || !/\d+.*(?:руб|₽|%)/.test(discount) || !terms.length) throw new Error("Неполная карточка ВкусВилл; обновление отменено");
      codes.push(officialCode(companyId, code, discount, terms, now));
    });
  } else if (companyId === 201) {
    const boards = $(".t396__artboard").filter((_, board) => /промокод/i.test($(board).text()));
    if (!boards.length || boards.length > 100) throw new Error("Не распознан список промокодов Магнит");
    boards.each((_, board) => {
      const pieces = $(board).children(".t396__elem").map((_, element) => text($(element).text())).get().filter(Boolean);
      const label = pieces.findIndex(piece => /^промокод$/i.test(piece));
      if (label < 0) return;
      const code = pieces[label + 1] ?? "";
      const discount = pieces.slice(label + 2).find(piece => /^[−–-]?\s*\d+(?:[.,]\d+)?\s*(?:%|₽|руб)/i.test(piece)) ?? "";
      const details = pieces.slice(label + 2).filter(piece => piece !== discount).map(piece => piece
        .replace(/заказот(?=\s|$)/gi, "заказ от").replace(/(\d)₽/g, "$1 ₽").replace(/,([^\s])/g, ", $1"));
      if (!code || !discount || !details.some(piece => /заказ|покупк/i.test(piece)) || !details.some(piece => /Магнит/i.test(piece))) {
        throw new Error("Неполная карточка Магнит; обновление отменено");
      }
      codes.push(officialCode(companyId, code, discount, details, now));
    });
    if (!codes.length) throw new Error("Коды Магнит не найдены в официальной карточке");
  } else throw new Error("Нет адаптера официального источника");
  const byCode = new Map<string, PromoCode>();
  for (const offer of codes) {
    const previous = byCode.get(offer.code);
    if (previous && JSON.stringify([previous.discount, previous.conditions]) !== JSON.stringify([offer.discount, offer.conditions])) {
      throw new Error("Один официальный код связан с разными условиями; обновление отменено");
    }
    byCode.set(offer.code, offer);
  }
  return mergePromoCodes(codes);
}
