import test from "node:test";
import assert from "node:assert/strict";
import { extractOfficialDates } from "../src/lib/promo-terms";
import { parsePromoDate } from "../src/lib/promo-parser";
import { parsePublicOfficial } from "../src/lib/public-official";
import { isActivePromo } from "../src/lib/promocodes";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./fixtures/vkusvill-official.html", import.meta.url), "utf8");
test("Russian numeric and written dates are validated and use Moscow calendar boundaries", () => {
  for (const date of ["5.11.2026", "05.11.2026", "5 ноября 2026", "5 ноября 2026 г."]) {
    assert.equal(parsePromoDate(date), Date.parse("2026-11-04T21:00:00Z"));
    assert.equal(parsePromoDate(date, true), Date.parse("2026-11-05T20:59:59.999Z"));
  }
  for (const date of ["31.02.2026", "29 февраля 2025", "5 ноября", "5 неизвестно 2026", "2026-02-31T12:00:00Z"]) assert.equal(parsePromoDate(date), undefined);
});
test("official date ranges may share an explicit year, but never infer it from the current date", () => {
  for (const terms of ["с 1.11 по 30.11.2026 включительно", "с 1 по 30 ноября 2026 года", "с 1 ноября 2026 по 30 ноября 2026", "с 1 ноября по 30 ноября 2026"]) {
    assert.deepEqual(extractOfficialDates(terms), { startsAt: parsePromoDate("01.11.2026"), expiresAt: parsePromoDate("30.11.2026", true) });
  }
  assert.equal(extractOfficialDates("Действует до 5 ноября 2026 года включительно").expiresAt, parsePromoDate("05.11.2026", true));
  assert.equal(extractOfficialDates("до 5 ноября 2026 в 18:30 МСК").expiresAt, Date.parse("2026-11-05T15:30:00Z"));
  assert.throws(() => extractOfficialDates("до 5 ноября 2026 в 18:30"));
  assert.throws(() => extractOfficialDates("до 5 ноября 2026 в 25:30 МСК"));
  assert.deepEqual(extractOfficialDates("На первый заказ от 1000 рублей"), { startsAt: undefined, expiresAt: undefined });
  for (const terms of ["до 31.02.2026", "по 30 ноября", "до 30.11", "с 30.11.2026 по 01.11.2026", "до 01.11.2026 и до 02.11.2026"]) assert.throws(() => extractOfficialDates(terms));
});
test("official cards keep grouped money and each card's terms; future campaigns are not active", () => {
  const dated = html.replace('-200&nbsp;', '-1 200,50&nbsp;').replace('1000&nbsp;', '2 500,75&nbsp;').replace('на&nbsp;первый заказ', 'Действует с 1 ноября 2027 по 30 ноября 2027. На первый заказ');
  const [offer] = parsePublicOfficial(54, dated, Date.parse("2026-11-05T12:00:00Z"));
  assert.equal(offer.discount, "1200.5 ₽");
  assert.equal(offer.minOrder, 2500.75);
  assert.equal(offer.startsAt, parsePromoDate("01.11.2027"));
  assert.equal(offer.status, "official");
  assert.equal(isActivePromo(offer, Date.parse("2026-11-05T12:00:00Z")), false);
  assert.equal(isActivePromo(offer, Date.parse("2027-11-05T12:00:00Z")), true);
  assert.throws(() => parsePublicOfficial(54, html + dated));
});
