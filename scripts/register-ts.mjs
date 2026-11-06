// Node 22.18+ native TypeScript runner: resolve project aliases and extensionless TS imports.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes("/node_modules/")) return nextResolve(specifier, context);
    let target;
    if (specifier.startsWith("@/")) target = path.join(root, "src", specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) target = fileURLToPath(new URL(specifier, context.parentURL));
    if (target) for (const extension of ["", ".ts", ".tsx", ".js"]) {
      if (existsSync(target + extension) && path.extname(target + extension)) return nextResolve(pathToFileURL(target + extension).href, context);
    }
    return nextResolve(specifier, context);
  },
});
