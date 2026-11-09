"use client";

import { useSyncExternalStore } from "react";
import type { PromoCode } from "@/lib/promocodes";
import { MAX_SAVED_PROMOS, parseSavedPromos, importSavedPromos, savedOfferMatches, SAVED_PROMOS_KEY, LEGACY_SAVED_PROMOS_KEY, type SavedPromo } from "@/lib/saved-promos";

const CHANGED_EVENT = "promospy:saved-promos-changed";
const EMPTY: SavedPromo[] = [];
let cachedRaw: string | null | undefined;
let cached: SavedPromo[] = EMPTY;
let memoryOnly = false;
const serverSnapshot = () => EMPTY;
function snapshot() {
  if (memoryOnly) return cached;
  try {
    const raw = window.localStorage.getItem(SAVED_PROMOS_KEY) ?? window.localStorage.getItem(LEGACY_SAVED_PROMOS_KEY);
    if (raw !== cachedRaw) { cachedRaw = raw; cached = parseSavedPromos(raw); }
  } catch { /* Reading storage may be disabled; rendering should still work. */ }
  return cached;
}
function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === SAVED_PROMOS_KEY || event.key === LEGACY_SAVED_PROMOS_KEY) listener(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED_EVENT, listener);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(CHANGED_EVENT, listener); };
}
const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;
export function useSavedPromos() {
  const items = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated);
  return { items, hydrated };
}
export function setPromoSaved(offer: Pick<PromoCode, "id" | "code" | "companyId"> & Partial<PromoCode>, save: boolean): string | null {
  const current = snapshot();
  const existing = current.some(item => savedOfferMatches(item,offer));
  if (existing === save) return null;
  if (save && current.length >= MAX_SAVED_PROMOS) return `Можно сохранить до ${MAX_SAVED_PROMOS} кодов. Удалите ненужный код и попробуйте снова.`;
  const next = save ? [{ id: offer.id, companyId: offer.companyId, code: offer.code, savedAt: Date.now(), snapshot: offer }, ...current]
    : current.filter(item => !savedOfferMatches(item,offer));
  return storeSavedPromos(next);
}
function storeSavedPromos(next: unknown[]): string | null {
  try {
    const validated = parseSavedPromos(JSON.stringify(next));
    if (validated.length !== next.length) return "Список слишком большой. Удалите несколько кодов.";
    const raw = JSON.stringify(validated);
    window.localStorage.setItem(SAVED_PROMOS_KEY, raw);
    cachedRaw = raw; cached = validated; memoryOnly = false;
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return null;
  } catch {
    cached = parseSavedPromos(JSON.stringify(next)); memoryOnly = true;
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return "Браузер запретил постоянное хранение. Избранное доступно только до перезагрузки или закрытия этой вкладки.";
  }
}
export function importFavorites(raw: string) {
  const result = importSavedPromos(raw,snapshot());
  return {added:result.added,skipped:result.skipped,warning:storeSavedPromos(result.items)};
}
