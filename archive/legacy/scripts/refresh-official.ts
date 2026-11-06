// Operator refresh uses the same durable queue, worker lease and source adapters as the server.
import { db } from "../src/lib/db";
import { getScanState } from "../src/lib/promo-store";
import { runWorkerTick } from "../src/lib/promo-worker";
import { PUBLIC_OFFICIAL_URLS } from "../src/lib/public-official";

const ids = process.argv.slice(2).map(Number);
if (!ids.length || ids.some(id => !PUBLIC_OFFICIAL_URLS[id])) throw new Error("Укажите ID 54 (ВкусВилл) и/или 201 (Магнит)");
try {
  for (const companyId of ids) {
    await db.promoScanJob.upsert({ where: { companyId }, create: { companyId, state: "queued" }, update: {} });
    await db.promoScanJob.updateMany({ where: { companyId, state: { in: ["idle", "failed"] } }, data: { state: "queued", requestedAt: new Date() } });
    if (!await runWorkerTick({ companyId, seed: false })) throw new Error("Сканер занят; повторите после завершения текущего задания");
    const state = await getScanState(companyId);
    console.log(JSON.stringify({ companyId, status: state.status, lastScan: state.lastScan, officialError: state.officialError,
      codes: state.codes.filter(code => code.evidence?.method === "source").map(({ code, status, checked }) => ({ code, status, checked })) }));
    if (state.officialError) process.exitCode = 1;
  }
} finally { await db.$disconnect(); }
