import { createRequire } from "node:module";
import { mergePromoCodes, parsePromoCodesFromHtml, parseMoney } from "./promo-parser";
import { extractOfficialDates } from "./promo-terms";
import type { PromoCode } from "./promocodes";
const { load } = createRequire(import.meta.url)("cheerio") as typeof import("cheerio");

export const PUBLIC_OFFICIAL_URLS: Record<number, string> = {
  54: "https://vkusvill.ru/promocodes/",
  201: "https://promo.magnit.ru/",
};
const text = (value: string) => value.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
function officialCode(companyId: number, code: string, discount: string, conditions: string[], now: number): PromoCode {
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]{1,63}$/u.test(code)) throw new Error("Изменился формат официального кода");
  const sourceUrl = PUBLIC_OFFICIAL_URLS[companyId];
  const terms = conditions.join(" ");
  const { expiresAt, startsAt } = extractOfficialDates(terms);
  const [offer] = parsePromoCodesFromHtml(JSON.stringify([{ promoCode: code, title: `${discount}: ${conditions[0]}`,
    expiresAt, startsAt,
    conditions, discountPercent: discount.match(/(\d+(?:[.,]\d+)?)\s*%/)?.[1]?.replace(",", "."),
    discountAmount: discount.includes("%") ? undefined : parseMoney(discount) }]), sourceUrl, companyId, now);
  if (!offer) throw new Error("Не распознана официальная карточка");
  return { ...offer, status: offer.status === "expired" ? "expired" : "official", checked: now,
    verificationDetails: "Код опубликован на официальном сайте. Применение в корзине не проверялось.",
    evidence: { method: "source", observedAt: now, sourceUrl, message: offer.description } };
}

/** Structure-specific parsers: never associate codes with terms from a neighbouring card. */
export function parsePublicOfficial(companyId: number, html: string, now = Date.now()): PromoCode[] {
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
    if (!/промокоды\s+магнит/i.test(text($("title").text()))) throw new Error("Не распознана страница промокодов Магнит");
    // The official landing has one promotion per Tilda record, with a standalone «Промокод» label.
    $(".t-rec").each((_, element) => {
      const record = $(element);
      const atoms = record.find(".tn-atom").map((_, e) => {
        const fragment = load($(e).html() ?? "");
        fragment("br").replaceWith(" ");
        return text(fragment.root().text());
      }).get().filter(Boolean);
      if (!atoms.includes("Промокод")) return;
      const codeAfterLabel = atoms[atoms.indexOf("Промокод") + 1];
      const buttons = [...new Set(record.find(".tn-atom__button-text").map((_, e) => text($(e).text())).get().filter(value => /^[\p{L}\p{N}][\p{L}\p{N}_-]{1,63}$/u.test(value)))];
      if (!buttons.length && /^[\p{L}\p{N}][\p{L}\p{N}_-]{1,63}$/u.test(codeAfterLabel ?? "")) buttons.push(codeAfterLabel);
      const discounts = atoms.filter(value => /^[−–-]?\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:%|₽|руб\.?|рублей)$/i.test(value));
      const terms = atoms.filter(value => /^Скидка на /i.test(value));
      const services = atoms.filter(value => /^в Магнит /i.test(value));
      if (buttons.length !== 1 || discounts.length !== 1 || terms.length !== 1 || services.length !== 1) throw new Error("Изменилась структура акции Магнит; условия нельзя однозначно связать с кодом");
      const extraTerms = atoms.filter(value => !["Промокод", "В приложение", ...buttons, ...discounts, ...terms, ...services].includes(value));
      codes.push(officialCode(companyId, buttons[0], discounts[0], [...terms, ...services, ...extraTerms], now));
    });
    if (!codes.length || codes.length > 100) throw new Error("Не распознан список промокодов Магнит");
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
