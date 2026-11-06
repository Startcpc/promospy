import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { waitForTanukiContent } from "../src/lib/tanuki-official";

test("initial HTTP 401 does not abort a page whose normal JavaScript loads the menu", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("https://tanuki-fixture.test/**", (route) => route.fulfill({ status: 401, contentType: "text/html; charset=utf-8",
      body: '<html><body><script>setTimeout(() => { document.body.innerHTML = \'<input placeholder="Поиск по меню">\'; }, 300)</script></body></html>' }));
    const response = await page.goto("https://tanuki-fixture.test/");
    assert.equal(response?.status(), 401);
    await waitForTanukiContent(page, page.getByPlaceholder("Поиск по меню", { exact: true }), response?.status());
    assert.equal(await page.getByRole("textbox").isVisible(), true);
  } finally { await browser.close(); }
});
