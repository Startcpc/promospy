import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = path.join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Checkpoint in-flight results before Next's own signal handler exits the process.
const checkpoint = () => { const flush = globalThis[Symbol.for('promospy.search.checkpoint')]; if (typeof flush === 'function') flush(); };
process.prependListener('SIGTERM', checkpoint);
process.prependListener('SIGINT', checkpoint);

// Keep search results outside the generated standalone bundle.
process.env.PROMO_SEARCH_DATA_DIR = path.resolve(root, process.env.PROMO_SEARCH_DATA_DIR ?? ".cache/promo-search");
await import(pathToFileURL(path.join(root, ".next", "standalone", "server.js")).href);
