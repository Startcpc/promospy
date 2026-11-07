import { cpSync, mkdirSync, rmSync } from "node:fs";
mkdirSync(".next/standalone/.next", { recursive: true });
for (const [source, destination] of [[".next/static", ".next/standalone/.next/static"], ["public", ".next/standalone/public"]]) {
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
}
