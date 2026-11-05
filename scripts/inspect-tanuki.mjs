import fs from "node:fs";
import { chromium } from "playwright";
fs.mkdirSync(".cache/tanuki", { recursive: true });
const urls = ["https://tanukifamily.ru/tanuki/", "https://www.tanukifamily.ru/tanuki/", "https://tanuki.ru/moscow/"];
for (const [index, url] of urls.entries()) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    fs.writeFileSync(`.cache/tanuki/http-${index}.html`, body);
    console.log(JSON.stringify({ requested: url, url: response.url, status: response.status,
      headers: Object.fromEntries([...response.headers].filter(([key]) => /server|www-authenticate|content-type|location|via/.test(key))), text: body.slice(0, 800) }));
  } catch (error) { console.log(url, error.message); }
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ locale: "ru-RU" });
  page.on("response", (response) => { if (response.url().includes("qrator")) console.log("BROWSER_CHECK", new URL(response.url()).pathname, response.status()); });
  page.on("requestfailed", (request) => console.log("REQUEST_FAILED", new URL(request.url()).hostname, new URL(request.url()).pathname, request.failure()?.errorText));
  const response = await page.goto(urls[0], { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => document.body.innerText.trim().length > 100, { timeout: 30000 }).catch(() => {});
  await page.screenshot({ path: ".cache/tanuki/landing.png", fullPage: true });
  console.log("BROWSER", response?.status(), page.url(), (await page.locator("body").innerText()).slice(0, 5000));
  console.log("LINKS", JSON.stringify(await page.locator("a[href]").evaluateAll((els) => els.map((el) => ({ text: el.textContent, href: el.href })).slice(0, 80))));
} finally { await browser.close(); }
