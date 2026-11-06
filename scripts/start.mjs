import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = path.join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Keep search results outside the generated standalone bundle.
process.env.PROMO_SEARCH_DATA_DIR = path.resolve(root, process.env.PROMO_SEARCH_DATA_DIR ?? ".cache/promo-search");
await import(pathToFileURL(path.join(root, ".next", "standalone", "server.js")).href);
