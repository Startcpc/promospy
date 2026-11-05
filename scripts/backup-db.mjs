import { backupDatabase, databasePath } from "./database-tools.mjs";
import path from "node:path";
const source = databasePath();
const destination = await backupDatabase(source, process.env.PROMO_BACKUP_DIR ?? path.join(path.dirname(source), "backups"), Number(process.env.PROMO_BACKUP_KEEP_DAYS ?? 14));
console.log(`Резервная копия проверена: ${destination}`);
