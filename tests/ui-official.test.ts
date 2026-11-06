// Isolated browser check: real parser fixtures, mocked API, no live merchant or database claims.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { parsePublicOfficial } from "../src/lib/public-official";

test("official cards: conditions, future filter, monitoring errors and mobile layout", async () => {
  const origin = "http://127.0.0.1:3124";
  const server = spawn(process.execPath, ["scripts/start.mjs"], {
    env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: "3124", PROMO_WORKER_ENABLED: "0" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  server.stdout.on("data", chunk => { logs += chunk; });
  server.stderr.on("data", chunk => { logs += chunk; });
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
    browser = await chromium.launch({ headless: true, ...(process.env.PROMO_TEST_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PROMO_TEST_CHROMIUM_EXECUTABLE } : {}) });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const checkedAt = Date.now() - 7200000;
    for (const [id, name] of [[54, "vkusvill"], [201, "magnit"]] as const) {
      const html = readFileSync(new URL(`./fixtures/${name}-official.html`, import.meta.url), "utf8");
      const [current] = parsePublicOfficial(id, html, checkedAt);
      current.evidence!.cartCheck = { status: "verified", details: "Проверка тестового сценария", observedAt: checkedAt, validUntil: Date.now() + 3600000 };
      const future = { ...current, id: `${id}:TEST-FUTURE`, code: "TEST-FUTURE", startsAt: Date.now() + 86400000 };
      await page.route(`**/api/scan/${id}`, route => route.fulfill({ json: {
        codes: [current, future], log: [], status: "idle", lastScan: checkedAt, nextScan: Date.now() + 3600000,
        error: null, officialCheckedAt: checkedAt, officialError: "Тестовая ошибка источника",
      } }));
      await page.goto(`${origin}/company/${id}`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: `Условия ${current.code}`, exact: true }).waitFor();
      assert.equal(await page.locator("article").count(), 2);
      assert.equal(await page.getByText("Корзина: Проверен в корзине", { exact: true }).count(), 2);
      await page.getByLabel("Только актуальные").check();
      assert.equal(await page.locator("article").count(), 1);
      assert.match(await page.locator("article").innerText(), new RegExp(current.code));
      await page.getByRole("button", { name: `Условия ${current.code}`, exact: true }).click();
      assert.match(await page.locator("article").innerText(), /Минимальный заказ: 1000 ₽/);
      assert.equal(await page.getByRole("button", { name: `Скопировать ${current.code}`, exact: true }).isEnabled(), true);
      await page.getByText("Не удалось обновить. Показываем сохранённые коды.", { exact: true }).waitFor();
      assert.equal(await page.locator(".scan-panel > details").getAttribute("open"), null);
      await page.getByText("Подробнее об обновлении", { exact: true }).click();
      assert.match(await page.locator(".scan-panel").innerText(), /Тестовая ошибка источника/);
      assert.match(await page.locator("body").innerText(), /Последнее успешное чтение/);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      mkdirSync("test-results", { recursive: true });
      await page.screenshot({ path: `test-results/${name}-mobile.png`, fullPage: true });
    }
    await page.route(/\/api\/promocodes\?/, route => route.fulfill({ json: { codes: [], hasMore: false } }));
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.getByRole("heading", { name: "Лови выгоду", exact: true }).waitFor();
    await page.locator(".letter-ink").first().hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".letter-ink")!).transform !== "none");
    await page.mouse.move(0, 0);
    await page.screenshot({ path: "test-results/home-redesign.png", fullPage: true, animations: "disabled" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator(".merchant-card").first().hover();
    assert.equal(await page.locator(".merchant-card").first().evaluate(el => getComputedStyle(el).transform), "none");
    await page.getByRole("button", { name: "Перекусить", exact: true }).click();
    assert.equal(await page.getByLabel("Категория магазинов").inputValue(), "Быстрое питание");
    await page.getByLabel("Поиск магазинов", { exact: true }).fill("картошка");
    assert.equal(await page.getByRole("button", { name: /Открыть логотип компании/ }).count(), 1);
    await page.getByLabel("Поиск магазинов", { exact: true }).fill("неизвестный магазин");
    await page.getByRole("button", { name: "Сбросить фильтры", exact: true }).click();
    assert.equal(await page.getByLabel("Категория магазинов").inputValue(), "");
    await page.setViewportSize({ width: 320, height: 740 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.screenshot({ path: "test-results/home-redesign-mobile.png", fullPage: true });
    await page.getByLabel("Категория магазинов").selectOption("Быстрое питание");
    await page.getByRole("button", { name: "Открыть логотип компании Крошка Картошка", exact: true }).click();
    await page.getByRole("heading", { name: "Промокоды Крошка Картошка", exact: true }).waitFor();
    await page.getByRole("link", { name: "Открыть официальные купоны и условия" }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); server.kill(); }
});
