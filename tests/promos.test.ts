import test from "node:test";
import assert from "node:assert/strict";
import { companies } from "../src/lib/companies";
import { CART_CONFIGS } from "../src/lib/merchant-config";
import { COMPANY_SLUGS, allowedSource } from "../src/lib/scan-engine";
import { parsePromoCodesFromHtml, mergePromoCodes, parseMoney, parsePromoDate } from "../src/lib/promo-parser";
import { classifyCartObservation } from "../src/lib/promo-verification";
import { effectiveStatus, matchesPromoQuery } from "../src/lib/promocodes";

const url = "https://promokodi.ru/store/ozon";
test("adjacent JSON offers retain their own descriptions, discounts and dates", () => {
  const html = JSON.stringify([
    { promoCode: "FIRST10", title: "First offer", discountPercent: 10, expiresAt: "2027-01-01" },
    { promoCode: "SECOND20", title: "Second offer", discountPercent: 20, expiresAt: "2027-02-01" },
  ]);
  const [first, second] = parsePromoCodesFromHtml(html, url, 208);
  assert.equal(first.description, "First offer");
  assert.equal(second.description, "Second offer");
  assert.equal(second.discount, "−20%");
  assert.notEqual(first.expiresAt, second.expiresAt);
});
test("embedded assignment handles escaped quotes and braces without evaluating JS", () => {
  const html = `<script>window.data = ${JSON.stringify({ offers: [{ promoCode: "hello-25", title: 'Подарок {"ролл"}', minOrder: "1 500,50" }] })};</script>`;
  const [code] = parsePromoCodesFromHtml(html, url, 301);
  assert.equal(code.code, "hello-25");
  assert.equal(code.description, 'Подарок {"ролл"}');
  assert.equal(code.minOrder, 1500.5);
  assert.equal(code.status, "found");
});
test("explicit DOM coupon attributes support Cyrillic and condition scoping", () => {
  const html = '<div data-offer><h3>Первый заказ</h3><span class="conditions">Только Москва</span><button data-promocode="ЛЕТО_25"></button></div><div data-offer><h3>Доставка</h3><button data-promocode="SHIP-10"></button></div>';
  const codes = parsePromoCodesFromHtml(html, url, 208);
  assert.equal(codes.length, 2);
  assert.deepEqual(codes[0].conditions, ["Только Москва"]);
  assert.equal(codes[1].description, "Доставка");
});
test("does not invent codes from random uppercase page text", () => {
  assert.deepEqual(parsePromoCodesFromHtml('<h1>SALE HTML FREE DELIVERY</h1>', url), []);
});
test("deduplication preserves independent sources and code case", () => {
  const a = parsePromoCodesFromHtml('[{"promoCode":"Abc-10"}]', url, 208);
  const b = parsePromoCodesFromHtml('[{"promoCode":"Abc-10"},{"promoCode":"ABC-10"}]', "https://promokodus.com/campaigns/ozon", 208);
  const result = mergePromoCodes([...a, ...b]);
  assert.equal(result.length, 2);
  assert.equal(result[0].sources.length, 2);
});
test("Russian money handles spaces and decimal fractions", () => {
  assert.equal(parseMoney("1\u00a0500,50 ₽"), 1500.5);
  assert.equal(parseMoney("2 000 ₽"), 2000);
  assert.equal(parseMoney("Сумма неизвестна"), undefined);
});
test("date-only expiry includes the whole Moscow day", () => {
  assert.equal(parsePromoDate("03.11.2026", true), Date.parse("2026-11-03T20:59:59.999Z"));
  assert.equal(parsePromoDate("завтра", true), undefined);
  assert.equal(parsePromoDate("2026-02-30", true), undefined);
});
test("all catalogue companies have matching source slugs and cart configurations", () => {
  for (const company of companies) { assert.ok(COMPANY_SLUGS[company.id], company.name); assert.ok(CART_CONFIGS[company.id], company.name); }
});
test("source allowlist rejects private hosts, userinfo, lookalikes and non-HTTPS", () => {
  const company = companies.find((c) => c.id === 208)!;
  for (const url of ["http://promokodi.ru", "https://promokodi.ru.evil.test", "https://127.0.0.1", "https://user@promokodi.ru", "https://promokodi.ru:8443"]) assert.equal(allowedSource(url, company), false);
  assert.equal(allowedSource("https://www.ozon.ru/", company), true);
});
const observation = { code: "SAVE10", appliedCode: "SAVE10", message: "Промокод SAVE10 применён", totalBefore: 2000, totalAfter: 1800, minOrder: 1500 };
test("requires explicit application of this code and a measured discount", () => {
  assert.equal(classifyCartObservation(observation).status, "verified");
  assert.equal(classifyCartObservation({ ...observation, appliedCode: "OTHER" }).status, "unavailable");
  assert.equal(classifyCartObservation({ ...observation, totalAfter: 2000 }).status, "unavailable");
  assert.equal(classifyCartObservation({ ...observation, message: "" }).status, "unavailable");
  assert.equal(classifyCartObservation({ ...observation, totalBefore: 200 }).status, "unavailable");
});
test("distinguishes expired codes, rejection and unavailable conditions", () => {
  assert.equal(classifyCartObservation({ ...observation, message: "Срок действия промокода истёк" }).status, "expired");
  assert.equal(classifyCartObservation({ ...observation, message: "Промокод недействителен" }).status, "rejected");
  assert.equal(classifyCartObservation({ ...observation, message: "Для применения войдите в аккаунт" }).status, "unavailable");
  assert.equal(classifyCartObservation({ ...observation, message: "Только на первый заказ" }).status, "unavailable");
});
test("expired verification loses confirmation without inventing expiry", () => {
  assert.equal(effectiveStatus({ status: "verified", validUntil: 100 }, 101), "found");
  assert.equal(effectiveStatus({ status: "verified", validUntil: 100, expiresAt: 50 }, 60), "expired");
});
test("offer search covers codes, descriptions and conditions", () => {
  const [code] = parsePromoCodesFromHtml('[{"promoCode":"SAVE10","title":"Скидка","conditions":["Первый заказ Москва"]}]', url, 208);
  assert.ok(matchesPromoQuery(code, "первый Москва"));
  assert.ok(matchesPromoQuery(code, "save10"));
  assert.equal(matchesPromoQuery(code, "Казань"), false);
});
test("explicit merchant metadata excludes another store's promotion", () => {
  const html = '[{"promoCode":"WRONG10","merchantName":"Tanuki"},{"promoCode":"RIGHT10","merchantName":"Ozon"}]';
  assert.deepEqual(parsePromoCodesFromHtml(html, url, 208).map((code) => code.code), ["RIGHT10"]);
});
test("aggregator nested shops, Unix dates and descriptions preserve real offer conditions", () => {
  const html = JSON.stringify([
    { promoCode: "TANUKI10", title: "На повторные заказы от 1490 рублей", description: "Не суммируется с другими акциями", startDate: 1786006213, endDate: 1796072399, shop: { title: "Тануки" } },
    { promoCode: "PIZZA10", title: "Твоя Пицца", shop: { title: "Твоя Пицца" } },
  ]);
  const codes = parsePromoCodesFromHtml(html, url, 301);
  assert.equal(codes.length, 1);
  assert.equal(codes[0].expiresAt, 1796072399000);
  assert.equal(codes[0].minOrder, 1490);
  assert.ok(codes[0].conditions.includes("Не суммируется с другими акциями"));
});
test("Tanuki source excludes sibling restaurant promotions despite parent shop metadata", () => {
  const html = JSON.stringify([
    { promoCode: "FISH10", title: "Подарок при заказе в ресторане Ёрш", shop: { title: "Тануки" } },
    { promoCode: "PIZZA10", title: "Первый заказ (Твоя Пицца)", shop: { title: "Тануки" } },
    { promoCode: "ROLL10", title: "Ролл в подарок", shop: { title: "Тануки" } },
  ]);
  assert.deepEqual(parsePromoCodesFromHtml(html, url, 301).map((code) => code.code), ["ROLL10"]);
});
