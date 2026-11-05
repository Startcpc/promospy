import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = path.join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Next's standalone entry changes cwd. Resolve local resources before importing it.
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl?.startsWith("file:") && !path.isAbsolute(databaseUrl.slice(5))) {
  process.env.DATABASE_URL = `file:${path.resolve(root, "prisma", databaseUrl.slice(5)).replaceAll("\\", "/")}`;
}
const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
if (browserPath && browserPath !== "0" && !path.isAbsolute(browserPath)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(root, browserPath);
}
await import(pathToFileURL(path.join(root, ".next", "standalone", "server.js")).href);
