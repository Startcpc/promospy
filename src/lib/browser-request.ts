/** Keep cancellation working in browsers without AbortSignal.any/timeout. */
export function browserRequestSignal(parent: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.addEventListener('abort', abort, {once:true});
  if (parent.aborted) abort();
  const timer = setTimeout(abort, timeoutMs);
  return {
    signal: controller.signal,
    abort,
    dispose() { clearTimeout(timer); parent.removeEventListener('abort', abort); },
  };
}
