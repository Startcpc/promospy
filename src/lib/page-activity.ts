/** Pause recurring requests while a page is hidden or the browser is offline. */
export function canRequestFromPage() {
  return !document.hidden && navigator.onLine !== false;
}
export function watchPageActivity(onResume: () => void, onPause: () => void) {
  let active = canRequestFromPage();
  const update = () => {
    const next = canRequestFromPage();
    if (next === active) return;
    active = next;
    if (active) onResume(); else onPause();
  };
  document.addEventListener('visibilitychange',update);
  window.addEventListener('online',update);
  window.addEventListener('offline',update);
  return () => {
    document.removeEventListener('visibilitychange',update);
    window.removeEventListener('online',update);
    window.removeEventListener('offline',update);
  };
}
