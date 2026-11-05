import type { Browser, Locator, Page } from "playwright";
import type { Company } from "./companies";
import { CART_CONFIGS } from "./merchant-config";
import { parseMoney } from "./promo-parser";
import type { PromoCode, PromoStatus, VerificationEvidence } from "./promocodes";

export type VerificationResult = { status: PromoStatus; details: string; evidence?: VerificationEvidence };
export type CartObservation = {
  code: string; message: string; appliedCode?: string;
  totalBefore?: number; totalAfter?: number; minOrder: number;
};

/** Only a scoped response to THIS submission may confirm or reject a code. */
export function classifyCartObservation(observation: CartObservation): VerificationResult {
  const { message, appliedCode, totalBefore, totalAfter, minOrder, code } = observation;
  if (totalBefore === undefined || totalBefore < minOrder) return { status: "unavailable", details: "Не подтверждена минимальная сумма заказа" };
  if (!message.trim()) return { status: "unavailable", details: "Сайт не предоставил результат применения промокода" };
  if (/войдите|авторизац|телефон|адрес|капч|captcha|перв\w* заказ|нов\w* клиент|минимальн|от\s+\d|категори|товар|регион|город/i.test(message)) {
    return { status: "unavailable", details: `Нужно уточнить условия: ${message.slice(0, 400)}` };
  }
  if (/ист[её]к|срок действия.*заверш|expired/i.test(message)) return { status: "expired", details: message.slice(0, 400) };
  if (/недействител|не существует|не найден|неверн|не примен|отклон|invalid|not valid|not applied/i.test(message)) {
    return { status: "rejected", details: message.slice(0, 400) };
  }
  const accepted = /(?:промокод|купон|код|скидка).*(?:примен[её]н|активирован)|(?:applied|activated)/i.test(message);
  if (appliedCode === code && accepted && totalAfter !== undefined && totalAfter < totalBefore) {
    return { status: "verified", details: `Подтверждено в тестовой корзине: ${totalBefore} ₽ → ${totalAfter} ₽` };
  }
  return { status: "unavailable", details: "Нет однозначного подтверждения скидки именно по этому коду" };
}

async function uniqueVisible(page: Page, selector: string): Promise<Locator | undefined> {
  const locator = page.locator(selector).filter({ visible: true });
  return await locator.count() === 1 ? locator : undefined;
}
async function amount(page: Page, selector: string) {
  const el = await uniqueVisible(page, selector);
  return el ? parseMoney(await el.innerText()) : undefined;
}

export async function verifyPromoWithBrowser(code: PromoCode, company: Company, signal?: AbortSignal): Promise<VerificationResult> {
  const config = CART_CONFIGS[company.id];
  if (!config) return { status: "unavailable", details: "Для магазина пока нет сценария проверки" };
  if (code.expiresAt && code.expiresAt <= Date.now()) return { status: "expired", details: "Срок действия указан в источнике" };
  if (code.startsAt && code.startsAt > Date.now()) return { status: "unavailable", details: "Акция ещё не началась" };
  if (company.id === 301) return { status: "unavailable", details: "Для проверки стороннего кода Тануки требует вход по СМС. Официальные коды отслеживаются по публичным акциям Москвы." };
  let browser: Browser | undefined;
  const cancel = () => { void browser?.close().catch(() => {}); };
  const timer = setTimeout(cancel, 45000);
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    signal?.throwIfAborted();
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, timeout: 15000 });
    signal?.throwIfAborted();
    const context = await browser.newContext({ locale: "ru-RU", viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const response = await page.goto(config.catalogUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    if (!response?.ok()) return { status: "unavailable", details: `Сайт недоступен: HTTP ${response?.status() ?? "?"}` };
    for (const step of config.preSteps ?? []) {
      const el = await uniqueVisible(page, step.selector);
      if (el) { if (step.type === "fill" && step.value) await el.fill(step.value); else await el.click(); }
    }
    const minOrder = code.minOrder ?? config.defaultMinOrder;
    let added = 0;
    for (let i = 0; i < config.maxItemsToAdd; i++) {
      signal?.throwIfAborted();
      const total = await amount(page, config.totalBeforeSelector);
      if (total !== undefined && total >= minOrder) break;
      const beforeElement = await uniqueVisible(page, config.totalBeforeSelector);
      const previousText = beforeElement ? await beforeElement.textContent() : null;
      const button = page.locator(config.addToCartSelector).filter({ visible: true }).first();
      await button.click();
      added++;
      // Wait for the cart to acknowledge the action, rather than assuming click means success.
      await page.waitForFunction(({ selector, previous }) => {
        const elements = [...document.querySelectorAll(selector)].filter((el) => (el as HTMLElement).offsetParent !== null);
        return elements.length === 1 && elements[0].textContent !== previous;
      }, { selector: config.totalBeforeSelector, previous: previousText }, { timeout: 2500 }).catch(() => {});
    }
    if (!added) return { status: "unavailable", details: "Не удалось наполнить тестовую корзину" };
    const cart = await uniqueVisible(page, config.cartLinkSelector);
    if (cart) await cart.click();
    const input = page.locator(config.promoInputSelector).filter({ visible: true });
    await input.waitFor({ state: "visible" });
    if (await input.count() !== 1) return { status: "unavailable", details: "Поле промокода не определено однозначно" };
    const totalBefore = await amount(page, config.totalBeforeSelector);
    if (totalBefore === undefined || totalBefore < minOrder) return { status: "unavailable", details: "Корзина не достигла минимальной суммы или сумма не определена" };
    // Limit observations to the promo widget. Never interpret unrelated body text or generic errors.
    const widget = input.locator('xpath=ancestor::*[@data-testid="promocode" or @data-testid="promo-code" or contains(@class,"promocode") or contains(@class,"promo-code") or contains(@class,"coupon")][1]');
    if (await widget.count() !== 1) return { status: "unavailable", details: "Не удалось выделить блок применения промокода" };
    const result = widget.locator('[role="alert"], [role="status"], [data-testid="promo-message"], [class*="message"], [class*="error"], [class*="success"]').filter({ visible: true });
    const previous = (await result.allTextContents()).join(" ").trim();
    await input.fill(code.code);
    const apply = widget.getByRole("button", { name: /^(Применить|Активировать)$/i });
    if (await apply.count() !== 1) return { status: "unavailable", details: "Кнопка применения промокода не определена" };
    await apply.click();
    // Wait for an actual changed response from the widget after submission.
    const deadline = Date.now() + 6000;
    let message = previous;
    do {
      signal?.throwIfAborted();
      message = (await result.allTextContents()).join(" ").trim();
      if (message && message !== previous) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    if (message === previous) return { status: "unavailable", details: "После отправки кода не получен новый ответ" };
    const totalAfter = await amount(page, config.totalAfterSelector);
    const applied = widget.locator('[data-applied-code], [data-testid="applied-promo-code"]');
    const appliedCode = await applied.count() === 1
      ? (await applied.getAttribute("data-applied-code") ?? await applied.innerText()).trim()
      : message.includes(code.code) ? code.code : undefined;
    const classified = classifyCartObservation({ code: code.code, message, appliedCode, totalBefore, totalAfter, minOrder });
    return {
      ...classified,
      evidence: { method: "browser", observedAt: Date.now(), message: message.slice(0, 500), totalBefore, totalAfter,
        region: company.id === 301 ? "Москва" : "Регион сайта по умолчанию", accountType: "Без авторизации",
        cart: `Тестовая корзина: ${added} добавлений товара; состав и доступность зависят от магазина` },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const details = signal?.aborted ? "Проверка прервана по лимиту времени"
      : /Executable doesn't exist/.test(message) ? "Браузер проверки не установлен на сервере"
        : error instanceof Error && error.name === "TimeoutError" ? "Сайт не ответил вовремя или изменил структуру страницы"
          : "Не удалось завершить браузерную проверку";
    return { status: "unavailable", details };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    await browser?.close().catch(() => {});
  }
}
