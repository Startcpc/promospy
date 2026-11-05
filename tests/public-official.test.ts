import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { collectPublicOfficial, parsePublicOfficial, PUBLIC_OFFICIAL_URLS } from "../src/lib/public-official";
import { getScanState, RETRY_INTERVAL, searchPublicPromos } from "../src/lib/promo-store";
import { runWorkerTick } from "../src/lib/promo-worker";

const fixtures = new Map([54, 201].map(id => [id, readFileSync(new URL(`./fixtures/${id === 54 ? "vkusvill" : "magnit"}-official.html`, import.meta.url), "utf8")]));
const response = (html: string, status = 200) => new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });

test("actual official markup preserves Cyrillic case, discount, minimum, conditions and source evidence", () => {
  for (const [id, html] of fixtures) {
    const [code] = parsePublicOfficial(id, html, 100000);
    assert.equal(code.code, id === 54 ? "1раз" : "ДОСТАВКА25");
    assert.equal(code.discount, id === 54 ? "200 ₽" : "−25%");
    assert.equal(code.minOrder, 1000);
    assert.equal(code.checked, 100000);
    assert.equal(code.status, "official");
    assert.equal(code.evidence?.sourceUrl, PUBLIC_OFFICIAL_URLS[id]);
    assert.equal(code.validUntil, undefined);
    assert.equal(code.evidence?.region, undefined); // No invented Moscow applicability.
    assert.ok(code.conditions.some(value => /первый заказ/.test(value)));
  }
  assert.match(parsePublicOfficial(201, fixtures.get(201)!)[0].conditions.join(" "), /Экспрессе.*Гипере.*Косметик/);
});

test("broken cards and unrelated 200 pages cannot produce a complete empty snapshot", () => {
  for (const id of [54, 201]) {
    assert.throws(() => parsePublicOfficial(id, '<h1>Проверка браузера</h1>'));
    assert.throws(() => parsePublicOfficial(id, fixtures.get(id)!.replaceAll(id === 54 ? "1раз" : "ДОСТАВКА25", "")));
  }
  assert.throws(() => parsePublicOfficial(201, fixtures.get(201)!.replace('ДОСТАВКА25</span>', 'ДОСТАВКА25</span><span class="tn-atom__button-text">OTHER</span>')));
  assert.throws(() => parsePublicOfficial(54, fixtures.get(54)!.replace('js-vv21-promocode-item__code', 'changed-code-format')));
});

test("explicit expiry is respected and duplicate carousel cards do not duplicate codes", () => {
  const html = fixtures.get(54)!;
  // Fixture text can contain nonbreaking spaces; insert the date into its subtitle directly.
  const dated = html.replace('class="subtitle _desktop-sm b700">', 'class="subtitle _desktop-sm b700">Действует до 01.01.2020. ');
  assert.equal(parsePublicOfficial(54, dated)[0].status, "expired");
  assert.equal(parsePublicOfficial(54, html + html).length, 1);
});

test("HTTP failures, redirects and malformed HTML are incomplete; collector requests only trusted public URL", async t => {
  let calls = 0;
  const mocked = t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    calls++;
    assert.equal(url, PUBLIC_OFFICIAL_URLS[54]); assert.equal(init?.redirect, "manual");
    assert.equal((init?.headers as Record<string, string>).Cookie, undefined);
    return response("<h1>Forbidden</h1>", calls === 1 ? 403 : calls === 2 ? 302 : 200);
  });
  try {
    for (let i = 0; i < 3; i++) {
      const snapshot = await collectPublicOfficial(54, AbortSignal.timeout(1000));
      assert.equal(snapshot.complete, false); assert.deepEqual(snapshot.codes, []); assert.ok(snapshot.error);
    }
  } finally { mocked.mock.restore(); }
});

test("both adapters run through the real queue: refresh, restart, failure retention, disappearance and reappearance", async t => {
  const folder = mkdtempSync(path.join(tmpdir(), "promospy-public-"));
  const datasourceUrl = `file:${path.join(folder, "test.db").replaceAll("\\", "/")}`;
  const client = new PrismaClient({ datasourceUrl });
  for (const sql of readFileSync(new URL("../prisma/bootstrap.sql", import.meta.url), "utf8").split(";").filter(part => part.trim())) await client.$executeRawUnsafe(sql);
  let html = "", status = 200, currentId = 54;
  const mocked = t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    assert.equal(url, PUBLIC_OFFICIAL_URLS[currentId]);
    return response(html, status);
  });
  async function scan(id: number) {
    currentId = id;
    await client.promoScanJob.upsert({ where: { companyId: id }, create: { companyId: id, state: "queued" }, update: { state: "queued" } });
    assert.equal(await runWorkerTick({ client, seed: false, companyId: id }), true);
    return getScanState(id, client);
  }
  try {
    for (const id of [54, 201]) {
      html = fixtures.get(id)!; status = 200;
      let state = await scan(id);
      const original = state.codes[0];
      assert.equal(original.status, "official"); assert.equal(state.officialError, undefined);
      state = await scan(id);
      assert.equal(state.codes.length, 1); assert.ok(state.codes[0].checked! >= original.checked!);
      const restarted = new PrismaClient({ datasourceUrl });
      try { assert.equal((await getScanState(id, restarted)).codes[0].code, original.code); }
      finally { await restarted.$disconnect(); }
      const lastSuccess = state.codes[0].checked;
      const lastMonitorSuccess = state.officialCheckedAt;
      status = 403;
      state = await scan(id);
      assert.equal(state.codes[0].status, "official"); assert.equal(state.codes[0].checked, lastSuccess);
      assert.match(state.officialError!, /403/);
      assert.equal(state.officialCheckedAt, lastMonitorSuccess);
      assert.ok(state.nextScan! - Date.now() <= RETRY_INTERVAL);
      status = 200; html = "<h1>Unexpected page</h1>";
      assert.equal((await scan(id)).codes[0].status, "official");
      html = fixtures.get(id)!.replaceAll(original.code, "НОВЫЙ2026");
      state = await scan(id);
      assert.equal(state.codes.find(code => code.code === original.code)?.status, "found");
      assert.equal(state.codes.find(code => code.code === "НОВЫЙ2026")?.status, "official");
      const active = await searchPublicPromos("", false, 0, client, Date.now(), true);
      assert.ok(!active.codes.some(code => code.companyId === id && code.code === original.code));
      html = fixtures.get(id)!;
      state = await scan(id);
      assert.equal(state.codes.find(code => code.code === original.code)?.status, "official");
      assert.equal(await client.promoOffer.count({ where: { companyId: id } }), 2);
      if (id === 54) {
        html = fixtures.get(id)!.replace('class="subtitle _desktop-sm b700">', 'class="subtitle _desktop-sm b700">С 01.01.2030 по 31.12.2030. ');
        state = await scan(id);
        assert.equal(state.codes.find(code => code.code === original.code)?.status, "official");
        const futureActive = await searchPublicPromos("", false, 0, client, Date.now(), true);
        assert.ok(!futureActive.codes.some(code => code.companyId === id));
      }
    }
  } finally { mocked.mock.restore(); await client.$disconnect(); }
});
