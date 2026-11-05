import { getCompanyById, type PromoCode } from "./promocodes";

export const SAVED_PROMOS_KEY = "promospy:saved-promos:v1";
export const MAX_SAVED_PROMOS = 100;
export type SavedPromo = Pick<PromoCode, "id" | "companyId" | "code"> & { savedAt: number };
export function validOfferId(value: unknown): value is string {
  return typeof value === "string" && /^[\p{L}\p{N}_:-]{1,128}$/u.test(value);
}
/** Local storage is untrusted and may contain data from an older application version. */
export function parseSavedPromos(raw: string | null): SavedPromo[] {
  if (!raw || raw.length > 100_000) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const unique = new Map<string, SavedPromo>();
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      if (!validOfferId(item.id) || typeof item.companyId !== "number" || !getCompanyById(item.companyId)
        || typeof item.code !== "string" || !/^[\p{L}\p{N}][\p{L}\p{N}_-]{1,63}$/u.test(item.code)
        || typeof item.savedAt !== "number" || !Number.isFinite(item.savedAt) || item.savedAt < 0) continue;
      // Persist identity only. Statuses, conditions and expiry must come from the server.
      if (!unique.has(item.id)) unique.set(item.id, { id: item.id, companyId: item.companyId, code: item.code, savedAt: item.savedAt });
      if (unique.size === MAX_SAVED_PROMOS) break;
    }
    return [...unique.values()];
  } catch { return []; }
}
export function parseSavedIds(raw: string | null): string[] | null {
  if (!raw || raw.length > MAX_SAVED_PROMOS * 129) return null;
  const ids = raw.split(",");
  if (ids.length > MAX_SAVED_PROMOS || !ids.every(validOfferId)) return null;
  return [...new Set(ids)];
}
