import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { getScanState, searchPublicPromos, toPromoCode } from "../src/lib/promo-store";
import { runWorkerTick } from "../src/lib/promo-worker";
import { visiblePromoCodes, INVALID_RETENTION_MS, effectiveStatus, type PromoCode } from "../src/lib/promocodes";
import { parseTanukiAction, type OfficialSnapshot } from "../src/lib/tanuki-official";

const actionUrl = "https://tanukifamily.ru/tanuki/actions/skidka-20-na-pervyj-zakaz";
const actionHtml = '<h1>Скидка 20% на первый заказ</h1><p>Оформите заказ с промокодом <strong>NEW20</strong> и получите скидку 20%.</p><p>Только доставка. Не суммируется с другими акциями.</p>';
function offer(code: string, changes: Partial<PromoCode> = {}): PromoCode {
  return { id: `301:${code}`, companyId: 301, code, description: code, discount: "10%", status: "found", found: Date.now(), sources: [], conditions: [], ...changes };
}
async function database() {
  const folder = mkdtempSync(path.join(tmpdir(), "promospy-lifecycle-"));
  const client = new PrismaClient({ datasourceUrl: `file:${path.join(folder, "test.db").replaceAll("\\", "/")}` });
  for (const sql of readFileSync(new URL("../prisma/bootstrap.sql", import.meta.url), "utf8").split(";").filter((part) => part.trim())) await client.$executeRawUnsafe(sql);
  return client;
}
async function scan(client: PrismaClient, codes: PromoCode[], official?: OfficialSnapshot) {
  await client.promoScanJob.upsert({ where: { companyId: 301 }, create: { companyId: 301 }, update: { state: "queued" } });
  assert.equal(await runWorkerTick({ client, seed: false, scan: async () => ({ codes, sourcesSucceeded: 1, sourcesTotal: 1, official }) }), true);
}

test("official actions preserve code, conditions, source evidence and freshness without basket verification", () => {
  const [code] = parseTanukiAction(actionHtml, actionUrl, 100000);
  assert.equal(code.status, "official"); assert.equal(code.code, "NEW20");
  assert.equal(code.discount, "−20%"); assert.ok(code.conditions.includes("Москва"));
  assert.equal(code.evidence?.method, "source"); assert.equal(code.evidence?.sourceUrl, actionUrl);
  assert.equal(parseTanukiAction(actionHtml, actionUrl.replace('/tanuki/actions/', '/tanuki/msk/actions/'))[0].code, "NEW20");
  assert.throws(() => parseTanukiAction(actionHtml, actionUrl.replace('/tanuki/actions/', '/tanuki/spb/actions/')));
  assert.equal(effectiveStatus(code, 100000 + 30 * INVALID_RETENTION_MS), "official");
  assert.deepEqual(parseTanukiAction('<h1>Скидка</h1><p>Скидка автоматически применяется. Введите промокод в корзине.</p>', actionUrl), []);
  assert.throws(() => parseTanukiAction(actionHtml, "https://example.org/tanuki/actions/promo"));
  assert.throws(() => parseTanukiAction('<h1>Forbidden</h1>', actionUrl));
  assert.equal(parseTanukiAction('<h1>Акция</h1><p>Промокод NEW20. Акция действует до 01.01.2020.</p>', actionUrl)[0].status, "expired");
});

test("negative offers sort last and disappear exactly after 24h; old successful checks do not age a new expiry", () => {
  const now = Date.now();
  const codes = [offer("REJECT", { status: "rejected", checked: now }), offer("FOUND"), offer("OFFICIAL", { status: "official", validUntil: now + 1000 }),
    offer("VALID", { status: "verified", validUntil: now + 1000 }), offer("NETWORK", { status: "unavailable", checked: now - 10 * INVALID_RETENTION_MS }),
    offer("EXPIRED", { status: "verified", checked: now - 10 * INVALID_RETENTION_MS, expiresAt: now - 1000 }),
    offer("OLD", { status: "rejected", invalidSince: now - INVALID_RETENTION_MS, checked: now })];
  assert.deepEqual(visiblePromoCodes(codes, now).map((code) => code.code).slice(0, 4), ["VALID", "OFFICIAL", "FOUND", "NETWORK"]);
  assert.ok(visiblePromoCodes(codes, now).some((code) => code.code === "EXPIRED"));
  assert.ok(!visiblePromoCodes(codes, now).some((code) => code.code === "OLD"));
});

test("repeated failures, rediscovery and timeouts do not restart the retention clock; real success restores the offer", async () => {
  const client = await database();
  try {
    const first = Date.now() - INVALID_RETENTION_MS - 1000;
    await scan(client, [offer("BAD", { status: "rejected", checked: first })]);
    await scan(client, [offer("BAD", { status: "rejected", checked: Date.now() })]);
    await scan(client, [offer("BAD", { status: "unavailable", checked: Date.now() })]);
    await scan(client, [offer("BAD", { description: "New marketing text" })]);
    const row = (await client.promoOffer.findFirst())!;
    assert.equal(row.invalidSince?.getTime(), first); assert.equal(row.status, "rejected");
    assert.equal((await getScanState(301, client)).codes.length, 0);
    assert.equal((await searchPublicPromos("", false, 0, client)).codes.length, 0);
    assert.equal((await getScanState(301, client, true)).codes.length, 1);
    await scan(client, [offer("BAD", { status: "verified", checked: Date.now(), validUntil: Date.now() + 10000 })]);
    assert.equal((await getScanState(301, client)).codes[0].status, "verified");
    assert.equal((await client.promoOffer.findFirst())!.invalidSince, null);
  } finally { await client.$disconnect(); }
});

test("official presence, disappearance, partial fetch, aggregator conflicts and reappearance", async () => {
  const client = await database();
  try {
    const [code] = parseTanukiAction(actionHtml, actionUrl);
    await scan(client, [{ ...code, status: "expired", expiresAt: 1000, minOrder: 9999 }]);
    await scan(client, [code], { codes: [code], complete: true, observedAt: Date.now() });
    let row = (await client.promoOffer.findFirst())!;
    assert.equal(row.expiresAt, null); assert.equal(row.minOrder, null); assert.equal(row.invalidSince, null);
    assert.equal(toPromoCode(row).status, "official");
    await scan(client, [offer("NEW20", { status: "expired", expiresAt: 1000 })], { codes: [], complete: false, observedAt: Date.now(), error: "HTTP 401" });
    row = (await client.promoOffer.findFirst())!;
    assert.equal(row.status, "official"); assert.equal(row.validUntil, null);
    assert.equal((await searchPublicPromos("", false, 0, client, Date.now() + 30 * INVALID_RETENTION_MS, true)).codes[0].status, "official");
    assert.equal(row.expiresAt, null); assert.equal(row.description, code.description);
    assert.equal((await getScanState(301, client)).officialError, "HTTP 401");
    await scan(client, [], { codes: [], complete: true, observedAt: Date.now() });
    row = (await client.promoOffer.findFirst())!;
    assert.equal(row.status, "found"); assert.equal(row.validUntil, null); assert.equal(row.invalidSince, null);
    assert.match(row.verificationDetails!, /больше не найден/);
    assert.equal((await searchPublicPromos("", false, 0, client, Date.now(), true)).codes.length, 0);
    await scan(client, [code], { codes: [code], complete: true, observedAt: Date.now() });
    assert.equal((await searchPublicPromos("", false, 0, client, Date.now(), true)).codes[0].status, "official");
    assert.equal((await searchPublicPromos("", true, 0, client)).codes.length, 0);
  } finally { await client.$disconnect(); }
});

test("global ranking and hiding apply before pagination and agree with company results", async () => {
  const client = await database();
  try {
    const now = Date.now();
    await scan(client, [offer("REJECTED", { status: "rejected", checked: now }),
      offer("HIDDEN", { status: "expired", expiresAt: now - INVALID_RETENTION_MS }),
      offer("JUSTEXPIRED", { status: "verified", checked: now - 2 * INVALID_RETENTION_MS, expiresAt: now - 1000 }),
      ...Array.from({ length: 32 }, (_, i) => offer(`FOUND${i}`)), ...parseTanukiAction(actionHtml, actionUrl),
      offer("CHECKED", { status: "verified", checked: now - 100, validUntil: now + 100000 })]);
    const first = await searchPublicPromos("", false, 0, client);
    const second = await searchPublicPromos("", false, 1, client);
    assert.equal(first.codes.length, 30); assert.equal(first.hasMore, true); assert.equal(second.hasMore, false);
    assert.deepEqual(first.codes.slice(0, 2).map((code) => code.code), ["CHECKED", "NEW20"]);
    assert.deepEqual(second.codes.slice(-2).map((code) => code.code), ["REJECTED", "JUSTEXPIRED"]);
    const combined = [...first.codes, ...second.codes];
    assert.equal(combined.length, 36); assert.equal(new Set(combined.map((code) => code.id)).size, 36);
    assert.deepEqual(combined.map((code) => code.id), (await getScanState(301, client)).codes.map((code) => code.id));
    assert.equal((await searchPublicPromos("new20 Москва", false, 0, client)).codes[0].code, "NEW20");
  } finally { await client.$disconnect(); }
});
