import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { companies } from "./companies";
import { db } from "./db";
import { getScanState, RETRY_INTERVAL, saveScanResult } from "./promo-store";
import { makeLogEntry, type ScanLogEntry } from "./promocodes";
import { runFullScan } from "./scan-engine";

const LEASE_MS = 90_000;
type WorkerOptions = { client?: PrismaClient; scan?: typeof runFullScan; seed?: boolean; companyId?: number };

/** One bounded job per tick. Durable lease prevents duplicate work across server processes. */
export async function runWorkerTick({ client = db, scan = runFullScan, seed = true, companyId: onlyCompanyId }: WorkerOptions = {}) {
  const now = new Date();
  if (seed) for (const company of companies) {
    await client.promoScanJob.upsert({ where: { companyId: company.id }, create: { companyId: company.id }, update: {} });
  }
  await client.promoWorkerLease.upsert({ where: { id: "scanner" }, create: { id: "scanner", owner: "", expiresAt: new Date(0) }, update: {} });
  const owner = randomUUID();
  const acquired = await client.promoWorkerLease.updateMany({ where: { id: "scanner", expiresAt: { lte: now } }, data: { owner, expiresAt: new Date(Date.now() + LEASE_MS) } });
  if (!acquired.count) return false;
  const abort = new AbortController();
  let companyId: number | undefined;
  const log: ScanLogEntry[] = [];
  let pendingLog = Promise.resolve();
  let lastLogWrite = 0;
  const appendLog = (entry: ScanLogEntry) => {
    log.push(entry);
    if (log.length > 60) log.shift();
    if (Date.now() - lastLogWrite < 1000 || companyId === undefined) return;
    lastLogWrite = Date.now();
    const snapshot = JSON.stringify(log);
    pendingLog = pendingLog.then(async () => {
      await client.promoScanJob.updateMany({ where: { companyId, owner, state: "running" }, data: { log: snapshot } });
    }).catch(() => { abort.abort(); });
  };
  let heartbeatRunning = false;
  const heartbeat = setInterval(async () => {
    if (heartbeatRunning) return;
    heartbeatRunning = true;
    try {
      const extended = await client.promoWorkerLease.updateMany({ where: { id: "scanner", owner, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date(Date.now() + LEASE_MS) } });
      if (!extended.count) abort.abort();
      if (companyId !== undefined) await client.promoScanJob.updateMany({ where: { companyId, owner }, data: { leaseUntil: new Date(Date.now() + LEASE_MS) } });
    } catch { abort.abort(); } finally { heartbeatRunning = false; }
  }, 15000);
  heartbeat.unref();
  const deadline = setTimeout(() => abort.abort(), 7 * 60_000);
  try {
    await client.promoScanJob.updateMany({ where: { state: "running", leaseUntil: { lte: now } }, data: { state: "queued", owner: null, leaseUntil: null } });
    await client.promoScanJob.updateMany({ where: { state: { in: ["idle", "failed"] }, nextRunAt: { lte: now } }, data: { state: "queued", requestedAt: now } });
    const job = await client.promoScanJob.findFirst({ where: { state: "queued", ...(onlyCompanyId === undefined ? {} : { companyId: onlyCompanyId }) }, orderBy: { requestedAt: "asc" } });
    if (!job) return false;
    companyId = job.companyId;
    const company = companies.find((item) => item.id === companyId);
    if (!company) throw new Error("Компания отсутствует в каталоге");
    await client.promoScanJob.update({ where: { companyId }, data: { state: "running", owner, startedAt: new Date(), leaseUntil: new Date(Date.now() + LEASE_MS), error: null, log: "[]" } });
    appendLog(makeLogEntry(`Обновление промокодов ${company.name}`, "info"));
    const previous = await getScanState(companyId, client, true);
    const result = await scan(company, appendLog, abort.signal, previous.codes);
    abort.signal.throwIfAborted();
    appendLog(makeLogEntry(`Обработано ${result.codes.length} кодов; источников доступно ${result.sourcesSucceeded} из ${result.sourcesTotal}`, "info"));
    await pendingLog;
    await saveScanResult(companyId, owner, result.codes, log, client, result.official);
    return true;
  } catch (error) {
    const message = abort.signal.aborted ? "Проверка прервана; сохранённые результаты не удалены" : error instanceof Error ? error.message : "Ошибка сканирования";
    await pendingLog;
    if (companyId !== undefined) await client.promoScanJob.updateMany({ where: { companyId, owner }, data: {
      state: "failed", error: message.slice(0, 500), owner: null, leaseUntil: null,
      nextRunAt: new Date(Date.now() + RETRY_INTERVAL), log: JSON.stringify([...log, makeLogEntry(message, "error")].slice(-60)),
    } });
    return false;
  } finally {
    clearInterval(heartbeat);
    clearTimeout(deadline);
    await client.promoWorkerLease.updateMany({ where: { id: "scanner", owner }, data: { expiresAt: new Date(0) } });
  }
}

const globalWorker = globalThis as unknown as { promoWorker?: ReturnType<typeof setInterval> };
export function startPromoWorker() {
  if (globalWorker.promoWorker) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runWorkerTick(); }
    catch (error) { console.error("Promo worker:", error instanceof Error ? error.message : error); }
    finally { running = false; }
  };
  globalWorker.promoWorker = setInterval(() => { void tick(); }, 5000);
  globalWorker.promoWorker.unref();
}
