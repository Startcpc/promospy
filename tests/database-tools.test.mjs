import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, writeFile, utimes, readdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { backupDatabase, restoreDatabase, checkDatabase } from "../scripts/database-tools.mjs";

test("online snapshot includes committed WAL, restores data, retains unrelated files and rejects corrupt sources", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "promospy-backup-"));
  const source = path.join(folder, "source.db"), directory = path.join(folder, "backups");
  const database = new DatabaseSync(source);
  try {
    database.exec(readFileSync(new URL("../prisma/bootstrap.sql", import.meta.url), "utf8"));
    database.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;");
    database.exec("INSERT INTO PromoScanJob(companyId) VALUES(54)");
    const first = await backupDatabase(source, directory, 1);
    const copy = new DatabaseSync(first, { readOnly: true });
    try { assert.equal(copy.prepare("SELECT COUNT(*) AS n FROM PromoScanJob").get().n, 1); } finally { copy.close(); }
    await utimes(first, new Date(0), new Date(0));
    const unrelated = path.join(directory, "important.db");
    await writeFile(unrelated, "keep"); await utimes(unrelated, new Date(0), new Date(0));
    const second = await backupDatabase(source, directory, 1);
    assert.equal((await readdir(directory)).includes(path.basename(first)), false);
    assert.equal((await readdir(directory)).includes("important.db"), true);
    database.exec("DELETE FROM PromoScanJob");
    database.close();
    await restoreDatabase(second, source, directory);
    const restored = new DatabaseSync(source, { readOnly: true });
    try { assert.equal(restored.prepare("SELECT COUNT(*) AS n FROM PromoScanJob").get().n, 1); } finally { restored.close(); }
    const bad = path.join(folder, "bad.db"); await writeFile(bad, "invalid");
    await assert.rejects(restoreDatabase(bad, source, directory));
    checkDatabase(source);
  } finally { if (database.isOpen) database.close(); await rm(folder, { recursive: true, force: true }); }
});
