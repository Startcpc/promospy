import { collectTanukiOfficial } from "../src/lib/tanuki-official";
const result = await collectTanukiOfficial(AbortSignal.timeout(110000));
console.log(JSON.stringify({ complete: result.complete, observedAt: result.observedAt,
  codes: result.codes.map(({ code, status, sources }) => ({ code, status, sources })), error: result.error }, null, 2));
if (!result.complete) process.exitCode = 1;
