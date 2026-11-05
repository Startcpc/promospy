export async function register() {
  // The bundled standalone server is long-lived. Serverless deployments must run a separate worker.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.PROMO_WORKER_ENABLED !== "0" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startPromoWorker } = await import("./lib/promo-worker");
    startPromoWorker();
  }
}
