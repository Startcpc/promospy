import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, rename, rm, chmod, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function databasePath(url = process.env.DATABASE_URL) {
  if (!url?.startsWith("file:") || !url.slice(5) || /[?#]/.test(url)) throw new Error("DATABASE_URL должен указывать на локальный SQLite-файл");
  return path.isAbsolute(url.slice(5)) ? url.slice(5) : path.resolve("prisma", url.slice(5));
}
export function checkDatabase(filename) {
  const database = new DatabaseSync(filename, { readOnly: true });
  try {
    const result = database.prepare("PRAGMA integrity_check").all();
    if (result.length !== 1 || result[0].integrity_check !== "ok") throw new Error("Проверка целостности SQLite не пройдена");
    for (const table of ["PromoOffer", "PromoCheck", "PromoScanJob", "PromoWorkerLease"]) {
      if (!database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)) throw new Error(`В базе отсутствует ${table}`);
    }
  } finally { database.close(); }
}
/** SQLite online backup includes committed WAL pages, unlike copying the database file. */
export async function backupDatabase(source, directory, keepDays = 14) {
  if (!Number.isFinite(keepDays) || keepDays < 1) throw new Error("Срок хранения должен быть не меньше одного дня");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = `promospy-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}.db`;
  const destination = path.join(directory, filename);
  const temporary = `${destination}.partial`;
  const database = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(database, temporary);
    checkDatabase(temporary);
    await chmod(temporary, 0o600);
    await rename(temporary, destination);
  } finally { database.close(); await rm(temporary, { force: true }); }
  // Retention only runs after a successful, validated snapshot.
  for (const entry of await readdir(directory)) {
    if (!/^promospy-\d{4}-\d{2}-\d{2}T[\d.-]+Z-[0-9a-f-]{36}\.db$/.test(entry) || entry === filename) continue;
    const candidate = path.join(directory, entry);
    const info = await stat(candidate);
    if (info.isFile() && info.mtimeMs < Date.now() - keepDays * 86400000) await rm(candidate);
  }
  return destination;
}
export async function restoreDatabase(source, destination, directory) {
  if (path.resolve(source) === path.resolve(destination)) throw new Error("Источник и назначение совпадают");
  checkDatabase(source);
  // Preserve the current database before touching it.
  if (existsSync(destination)) await backupDatabase(destination, directory);
  await mkdir(path.dirname(destination), { recursive: true });
  const database = new DatabaseSync(source, { readOnly: true });
  try { await backup(database, destination); } finally { database.close(); }
  checkDatabase(destination);
  await chmod(destination, 0o600);
}
