import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
if (!existsSync(".next/standalone/server.js")) throw new Error("Standalone server was not emitted at the project root. Check outputFileTracingRoot.");
mkdirSync(".next/standalone/.next", { recursive: true });
for (const [source, destination] of [[".next/static", ".next/standalone/.next/static"], ["public", ".next/standalone/public"]]) {
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
}
