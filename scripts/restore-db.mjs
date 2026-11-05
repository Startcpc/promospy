import path from "node:path";
import { databasePath, restoreDatabase } from "./database-tools.mjs";
const source = process.argv[2];
if (!source || !process.argv.includes("--server-stopped")) throw new Error("Сначала остановите сервер и worker. Затем: pnpm db:restore путь/копия.db --server-stopped");
const destination = databasePath();
await restoreDatabase(source, destination, process.env.PROMO_BACKUP_DIR ?? path.join(path.dirname(destination), "backups"));
console.log("База восстановлена и проверена. Можно запустить сервер.");
