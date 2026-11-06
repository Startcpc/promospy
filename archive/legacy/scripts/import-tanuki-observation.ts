// Operator-only import of public action HTML read in an ordinary browser.
// This is never run by the worker, and cannot renew freshness by replaying an old observation.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { parseTanukiAction, MAX_MANUAL_OBSERVATION_AGE_MS } from "../src/lib/tanuki-official";
import { saveScanResult } from "../src/lib/promo-store";
import { mergePromoCodes } from "../src/lib/promo-parser";

const input = JSON.parse(readFileSync(process.argv[2], "utf8")) as { observedAt: string; pages: { url: string; html: string }[] };
const observedAt = Date.parse(input.observedAt);
if (!Number.isFinite(observedAt) || observedAt > Date.now() || Date.now() - observedAt >= MAX_MANUAL_OBSERVATION_AGE_MS) throw new Error("Нужна отметка времени реального наблюдения не старше 6 часов");
if (!Array.isArray(input.pages) || !input.pages.length || input.pages.length > 30) throw new Error("Нужны публичные страницы официальных акций");
const codes = mergePromoCodes(input.pages.flatMap(({ html, url }) => parseTanukiAction(html, url, observedAt)));
if (!codes.length) throw new Error("Явные промокоды не найдены; ничего не изменено");
const owner = randomUUID();
try {
  await db.promoWorkerLease.upsert({ where: { id: "scanner" }, create: { id: "scanner", owner: "", expiresAt: new Date(0) }, update: {} });
  const acquired = await db.promoWorkerLease.updateMany({ where: { id: "scanner", expiresAt: { lte: new Date() } }, data: { owner, expiresAt: new Date(Date.now() + 60000) } });
  if (!acquired.count) throw new Error("Сканер занят. Повторите после завершения текущего задания");
  await db.promoScanJob.upsert({ where: { companyId: 301 }, create: { companyId: 301, state: "running", owner }, update: { state: "running", owner } });
  await saveScanResult(301, owner, codes, [{ time: observedAt, type: "info", text: "Сохранены публичные акции Москвы, просмотренные оператором в обычном браузере" }], db,
    { codes, complete: false, observedAt, error: "Первичное наблюдение в браузере. Полнота автоматического мониторинга пока не подтверждена." });
  console.log(`Сохранено официальных кодов: ${codes.length}. Время источника: ${input.observedAt}.`);
} finally {
  await db.promoWorkerLease.updateMany({ where: { id: "scanner", owner }, data: { expiresAt: new Date(0) } });
  await db.$disconnect();
}

