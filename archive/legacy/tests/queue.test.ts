import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { requestScan, getScanState } from "../src/lib/promo-store";
import { runWorkerTick } from "../src/lib/promo-worker";
import { parsePromoCodesFromHtml } from "../src/lib/promo-parser";
import type { PromoCode } from "../src/lib/promocodes";

test("durable queue: deduplication, leases, history, cooldown, failed scans and recovery", async (t) => {
  const folder = mkdtempSync(path.join(tmpdir(), "promospy-tests-"));
  const databaseUrl = `file:${path.join(folder, "test.db").replaceAll("\\", "/")}`;
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const sql = readFileSync(new URL("../prisma/bootstrap.sql", import.meta.url), "utf8");
  for (const statement of sql.split(";").filter((part) => part.trim())) await client.$executeRawUnsafe(statement);
  const [offer] = parsePromoCodesFromHtml('[{"promoCode":"SAVE10","title":"Первый заказ"}]', "https://promokodi.ru/store/ozon", 208);
  const confirmed: PromoCode = { ...offer, status: "verified", checked: Date.now(), validUntil: Date.now() + 3600000, verificationDetails: "Подтверждено в тестовой корзине" };
  let calls = 0;
  const scan = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { codes: [confirmed], sourcesSucceeded: 1, sourcesTotal: 2 };
  };
  try {
    await t.test("many visitors create one pending job", async () => {
      await Promise.all(Array.from({ length: 8 }, () => requestScan(208, client)));
      assert.equal(await client.promoScanJob.count(), 1);
      assert.equal((await getScanState(208, client)).status, "queued");
    });
    await t.test("concurrent workers perform one scan and store its evidence", async () => {
      await Promise.all([runWorkerTick({ client, scan, seed: false }), runWorkerTick({ client, scan, seed: false })]);
      assert.equal(calls, 1);
      const state = await getScanState(208, client);
      assert.equal(state.status, "idle");
      assert.equal(state.codes.length, 1);
      assert.equal(state.codes[0].status, "verified");
      assert.equal(await client.promoCheck.count(), 1);
    });
    await t.test("another process sees the same saved results", async () => {
      const secondClient = new PrismaClient({ datasourceUrl: databaseUrl });
      try { assert.equal((await getScanState(208, secondClient)).codes[0].code, "SAVE10"); }
      finally { await secondClient.$disconnect(); }
    });
    await t.test("refresh requests respect the shared cooldown", async () => {
      await requestScan(208, client);
      assert.equal((await getScanState(208, client)).status, "idle");
      assert.equal(await runWorkerTick({ client, scan, seed: false }), false);
      assert.equal(calls, 1);
    });
    await t.test("discovery without a check preserves existing history and does not extend freshness", async () => {
      await client.promoScanJob.update({ where: { companyId: 208 }, data: { state: "queued" } });
      await runWorkerTick({ client, seed: false, scan: async () => ({ codes: [offer], sourcesSucceeded: 1, sourcesTotal: 1 }) });
      const state = await getScanState(208, client);
      assert.equal(state.codes[0].status, "verified");
      assert.equal(state.codes[0].validUntil, confirmed.validUntil);
      assert.equal(await client.promoCheck.count(), 1);
    });
    await t.test("source failure leaves stored offers intact and schedules a retry", async () => {
      await client.promoScanJob.update({ where: { companyId: 208 }, data: { state: "queued" } });
      await runWorkerTick({ client, seed: false, scan: async () => { throw new Error("All sources unavailable"); } });
      const state = await getScanState(208, client);
      assert.equal(state.status, "failed");
      assert.equal(state.codes.length, 1);
      assert.match(state.error!, /unavailable/);
      assert.ok(state.nextScan! > Date.now());
    });
    await t.test("changed campaign conditions invalidate an earlier confirmation", async () => {
      await client.promoScanJob.update({ where: { companyId: 208 }, data: { state: "queued" } });
      await runWorkerTick({ client, seed: false, scan: async () => ({ codes: [{ ...offer, minOrder: 5000 }], sourcesSucceeded: 1, sourcesTotal: 1 }) });
      assert.equal((await getScanState(208, client)).codes[0].status, "found");
      assert.equal(await client.promoCheck.count(), 1);
    });
    await t.test("expired worker leases recover interrupted jobs", async () => {
      await client.promoScanJob.update({ where: { companyId: 208 }, data: { state: "running", owner: "dead-worker", leaseUntil: new Date(0) } });
      await runWorkerTick({ client, scan, seed: false });
      assert.equal((await getScanState(208, client)).status, "idle");
      assert.equal(await client.promoOffer.count(), 1);
      assert.equal(await client.promoCheck.count(), 2);
    });
    await t.test("old confirmation is no longer displayed as verified", async () => {
      await client.promoOffer.updateMany({ data: { validUntil: new Date(0) } });
      assert.equal((await getScanState(208, client)).codes[0].status, "found");
    });
  } finally { await client.$disconnect(); }
});
