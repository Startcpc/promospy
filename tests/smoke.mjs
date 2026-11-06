import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

const folder = mkdtempSync(path.join(tmpdir(), "promospy-smoke-"));
const databaseUrl = `file:${path.join(folder, "smoke.db").replaceAll("\\", "/")}`;
const client = new PrismaClient({ datasourceUrl: databaseUrl });
for (const sql of readFileSync("prisma/bootstrap.sql", "utf8").split(";").filter((part) => part.trim())) await client.$executeRawUnsafe(sql);
for (const [code, description, status] of [["TEST-VERIFIED", "Доставка: первый заказ", "verified"], ["TEST-FOUND", "Первый заказ от 1500 рублей", "found"]]) {
  await client.promoOffer.create({ data: { companyId: 208, code, codeKey: code, description, searchText: `${code} ${description}`.toLocaleLowerCase("ru"),
    discount: "10%", status, validUntil: status === "verified" ? new Date(Date.now() + 3600000) : null,
    checkedAt: status === "verified" ? new Date() : null,
    sources: JSON.stringify([{ url: "https://www.ozon.ru/", name: "ozon.ru", seenAt: Date.now() }]),
  } });
}
for (const [code, status, invalidSince] of [["MOSCOW-OFFICIAL", "official", null], ["MOSCOW-UNKNOWN", "unavailable", null], ["MOSCOW-REJECTED", "rejected", new Date()], ["MOSCOW-HIDDEN", "rejected", new Date(Date.now() - 86400001)]]) {
  await client.promoOffer.create({ data: { companyId: 301, code, codeKey: code, description: "Московская акция", discount: "20%", status,
    invalidSince, validUntil: status === "official" ? new Date(Date.now() + 3600000) : null,
    checkedAt: new Date(), evidence: status === "official" ? JSON.stringify({ method: "source", region: "Москва", observedAt: Date.now(), message: "Публичная акция" }) : null } });
}
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  env: { ...process.env, PORT: "3123", HOSTNAME: "127.0.0.1", DATABASE_URL: databaseUrl, PROMO_WORKER_ENABLED: "0" },
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
});
let serverLog = "";
server.stdout.on("data", (data) => { serverLog += data; });
server.stderr.on("data", (data) => { serverLog += data; });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { ready = (await fetch("http://127.0.0.1:3123/api")).ok; } catch { /* Starting. */ }
    if (ready) break;
    if (server.exitCode !== null) throw new Error(serverLog);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, serverLog);
  const results = await Promise.all(Array.from({ length: 5 }, () => fetch("http://127.0.0.1:3123/api/scan/208", { method: "POST" })));
  assert.ok(results.every((response) => response.status === 202));
  assert.equal(await client.promoScanJob.count(), 1);
  assert.equal((await fetch("http://127.0.0.1:3123/api/scan/nope")).status, 404);
  assert.equal((await fetch("http://127.0.0.1:3123/api/scan/208", { method: "POST", headers: { Origin: "https://unrelated.example" } })).status, 403);
  assert.equal((await fetch("http://127.0.0.1:3123/api/scan/208", { method: "POST", headers: { Origin: "https://example-preview.app.github.dev", Host: "example-preview.app.github.dev" } })).status, 202);
  const search = await (await fetch("http://127.0.0.1:3123/api/promocodes?q=" + encodeURIComponent("ДОСТАВКА"))).json();
  assert.ok(search.codes.some((code) => code.code === "TEST-VERIFIED"));
  assert.ok(!search.codes.some((code) => code.code === "MOSCOW-HIDDEN"));
  const savedExpired = await client.promoOffer.create({ data: {
    companyId: 54, code: "SAVED-EXPIRED", codeKey: "SAVED-EXPIRED", description: "Истёкшая акция", discount: "10%",
    status: "official", expiresAt: new Date(Date.now() - 86400001),
  } });
  const savedHidden = await client.promoOffer.findFirstOrThrow({ where: { code: "MOSCOW-HIDDEN" } });
  const savedResponse = await fetch("http://127.0.0.1:3123/api/promocodes/saved?ids=" + encodeURIComponent([savedExpired.id, savedHidden.id, "missing-offer"].join(",")));
  assert.equal(savedResponse.status, 200);
  assert.equal(savedResponse.headers.get("cache-control"), "no-store");
  const saved = await savedResponse.json();
  assert.equal(saved.codes.find(code => code.id === savedExpired.id).status, "expired");
  assert.equal(saved.codes.find(code => code.id === savedHidden.id).status, "rejected");
  assert.deepEqual(saved.missingIds, ["missing-offer"]);
  assert.equal((await fetch("http://127.0.0.1:3123/api/promocodes/saved?ids=a,")).status, 400);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:3123/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Поиск промокодов и предложений" }).waitFor();
  await page.getByLabel("Поиск предложений", { exact: true }).fill("первый");
  await page.waitForFunction(() => document.querySelectorAll("article").length === 2);
  await page.getByLabel("Только актуальные").check();
  await page.waitForFunction(() => document.querySelectorAll("article").length === 1);
  assert.match(await page.locator("article").innerText(), /TEST-VERIFIED/);
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/home.png", fullPage: true });
  await page.goto("http://127.0.0.1:3123/company/208", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Промокоды Ozon", exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll("article").length === 2, { timeout: 10000 }).catch(async (error) => {
    console.error("Company page:", await page.locator("body").innerText(), "Browser errors:", errors);
    throw error;
  });
  assert.equal(await page.locator("article").count(), 2);
  await page.getByLabel("Поиск по промокодам и условиям").fill("TEST-FOUND");
  assert.equal(await page.locator("article").count(), 1);
  assert.match(await page.locator("article").innerText(), /Не проверен/);
  await page.getByRole("button", { name: "Условия TEST-FOUND", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Скопировать TEST-FOUND" }).isDisabled(), false);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.screenshot({ path: "test-results/company-mobile.png", fullPage: true });
  await page.route("**/api/scan/208", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Хранилище временно недоступно" }) }));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("alert").filter({ hasText: "Хранилище временно недоступно" }).waitFor();
  assert.equal(await page.locator("article").count(), 0);
  await page.goto("http://127.0.0.1:3123/company/301", { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll("article").length === 3);
  assert.match(await page.locator("article").first().innerText(), /На официальном сайте/);
  assert.match(await page.locator("article").last().innerText(), /MOSCOW-REJECTED/);
  assert.doesNotMatch(await page.locator("body").innerText(), /MOSCOW-HIDDEN/);
  await page.getByLabel("Только актуальные").check();
  assert.equal(await page.locator("article").count(), 1);
  assert.deepEqual(errors, []);
  console.log("PASS: production API, queue deduplication, Cyrillic search, verified filter, mobile layout, server-failure state; no browser runtime errors.");
} catch (error) { console.error(serverLog); throw error; }
finally { await browser?.close(); server.kill(); await client.$disconnect(); }
