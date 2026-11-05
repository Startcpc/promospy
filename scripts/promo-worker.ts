import { runWorkerTick } from "../src/lib/promo-worker";
import { db } from "../src/lib/db";
let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
while (!stopping) {
  try { await runWorkerTick(); } catch (error) { console.error(error); }
  if (!stopping) await new Promise((resolve) => setTimeout(resolve, 5000));
}
await db.$disconnect();
