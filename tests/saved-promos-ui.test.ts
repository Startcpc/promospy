// Real browser and localStorage; API fixtures isolate this feature from merchant/network failures.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { parsePublicOfficial } from "../src/lib/public-official";
import { SAVED_PROMOS_KEY } from "../src/lib/saved-promos";
import type { PromoCode } from "../src/lib/promocodes";

test("saved codes survive reload, sync tabs, refresh expiry and never reuse stale confirmations on failure", async () => {
  const origin = "http://127.0.0.1:3125";
  const server = spawn(process.execPath, ["scripts/start.mjs"], { env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: "3125", PROMO_WORKER_ENABLED: "0" }, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  server.stdout.on("data", data => { logs += data; }); server.stderr.on("data", data => { logs += data; });
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { ready = (await fetch(`${origin}/api`)).ok; } catch { /* Starting. */ }
      if (ready) break;
      if (server.exitCode !== null) throw new Error(logs);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready, logs);
    // The actual route must reject invalid lookups without accessing the database.
    for (const ids of ["", "a,", "a b", Array(101).fill("id").join(",")]) {
      const response = await fetch(`${origin}/api/promocodes/saved?ids=${encodeURIComponent(ids)}`);
      assert.equal(response.status, 400);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    browser = await chromium.launch({ headless: true, ...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PROMO_TEST_CHROMIUM_EXECUTABLE } : {}) });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const codes = [54, 201].map(id => parsePublicOfficial(id, readFileSync(new URL(`./fixtures/${id === 54 ? "vkusvill" : "magnit"}-official.html`, import.meta.url), "utf8"))[0]);
    let refreshed: PromoCode[] = codes;
    let fail = false;
    await context.route(/\/api\/scan\/\d+$/, route => {
      const id = Number(new URL(route.request().url()).pathname.split("/").pop());
      return route.fulfill({ json: { codes: codes.filter(code => code.companyId === id), log: [], status: "idle", lastScan: Date.now(), nextScan: Date.now() + 3600000, error: null } });
    });
    await context.route(/\/api\/promocodes\?/, route => route.fulfill({ json: { codes, hasMore: false } }));
    await context.route(/\/api\/promocodes\/saved\?/, route => {
      const ids = new URL(route.request().url()).searchParams.get("ids")!.split(",");
      return route.fulfill(fail ? { status: 503, json: { error: "Тестовая ошибка обновления" } } : { json: { codes: refreshed.filter(code => ids.includes(code.id)), missingIds: ids.filter(id => !refreshed.some(code => code.id === id)) } });
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${origin}/saved`);
    await page.getByText("Пока нет сохранённых кодов", { exact: true }).waitFor();
    await page.goto(`${origin}/company/54`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Сохранить 1раз", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Удалить из избранного 1раз", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByRole("link", { name: "Избранное (1)", exact: true }).waitFor();
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Сохранить ДОСТАВКА25", exact: true }).click();
    await page.getByRole("link", { name: "Избранное (2)", exact: true }).click();
    await page.getByRole("button", { name: "Условия ДОСТАВКА25", exact: true }).waitFor();
    assert.equal(await page.locator("article").count(), 2);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Условия 1раз", exact: true }).waitFor();
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVED_PROMOS_KEY);
    assert.equal(stored.length, 2);
    assert.ok(stored.every((item: Record<string, unknown>) => !Object.hasOwn(item, "status") && !Object.hasOwn(item, "conditions")));
    await page.getByLabel("Поиск в избранном", { exact: true }).fill("ВкусВилл первый");
    assert.equal(await page.locator("article").count(), 1);
    await page.getByLabel("Поиск в избранном", { exact: true }).fill("");
    refreshed = [{ ...codes[0], expiresAt: Date.now() - 86400001 }, codes[1]];
    await page.getByRole("button", { name: "Обновить статусы", exact: true }).click();
    await page.getByText("Срок истёк", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Скопировать 1раз", exact: true }).isDisabled(), true);
    await page.getByLabel("Только актуальные").check();
    assert.equal(await page.locator("article").count(), 1);
    await page.getByLabel("Только актуальные").uncheck();
    fail = true;
    await page.getByRole("button", { name: "Обновить статусы", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Тестовая ошибка обновления" }).waitFor();
    assert.equal(await page.getByText("На официальном сайте", { exact: true }).count(), 0);
    assert.equal(await page.locator("article").count(), 2);
    fail = false; refreshed = [codes[1]];
    await page.getByRole("button", { name: "Обновить статусы", exact: true }).click();
    await page.getByText("Предложение больше не найдено.", { exact: false }).waitFor();
    assert.equal(await page.locator("article").count(), 2);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    mkdirSync("test-results", { recursive: true });
    await page.screenshot({ path: "test-results/saved-mobile.png", fullPage: true });
    const second = await context.newPage();
    await second.goto(`${origin}/company/54`, { waitUntil: "networkidle" });
    await second.getByRole("button", { name: "Удалить из избранного 1раз", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector("main")?.textContent?.includes("1раз"));
    await page.getByRole("button", { name: "Удалить из избранного ДОСТАВКА25", exact: true }).click();
    await page.getByText("Пока нет сохранённых кодов", { exact: true }).waitFor();
    await second.getByRole("link", { name: "Избранное", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    // A disabled storage API must show a failure instead of claiming the code was saved.
    const blocked = await browser.newContext();
    await blocked.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("Storage disabled for test"); }; });
    await blocked.route(/\/api\/scan\/54$/, route => route.fulfill({ json: { codes: [codes[0]], log: [], status: "idle", lastScan: null, nextScan: null, error: null } }));
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(`${origin}/company/54`, { waitUntil: "networkidle" });
    await blockedPage.getByRole("button", { name: "Сохранить 1раз", exact: true }).click();
    await blockedPage.getByRole("alert").filter({ hasText: "Не удалось изменить избранное" }).waitFor();
    assert.equal(await blockedPage.getByRole("button", { name: "Сохранить 1раз", exact: true }).getAttribute("aria-pressed"), "false");
    await blocked.close();
  } finally { await browser?.close(); server.kill(); }
});
