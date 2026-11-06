import { getCompanyById, type PromoCode } from "./promocodes";

export const SAVED_PROMOS_KEY = "promospy:saved-promos:v1";
export const MAX_SAVED_PROMOS = 100;
export type SavedPromo = Pick<PromoCode, "id" | "companyId" | "code"> & { savedAt: number; snapshot?: PromoCode };
export function validOfferId(value: unknown): value is string {
  return typeof value === "string" && /^[\p{L}\p{N}_:-]{1,128}$/u.test(value);
}
/** Local storage is untrusted and may contain data from an older application version. */
export function parseSavedPromos(raw: string | null): SavedPromo[] {
  if (!raw || raw.length > 1_000_000) return [];
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
      let snapshot: PromoCode | undefined;
      const rawOffer = item.snapshot as Partial<PromoCode> | undefined;
      if (rawOffer && rawOffer.id === item.id && rawOffer.code === item.code && rawOffer.companyId === item.companyId && typeof rawOffer.description === "string") {
        const sources = Array.isArray(rawOffer.sources) ? rawOffer.sources.filter(source => {
          try { const url = new URL(source.url); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
        }).slice(0,10).map(source => ({ url: source.url.slice(0,2000), name: new URL(source.url).hostname, seenAt: item.savedAt as number })) : [];
        snapshot = { id: item.id, code: item.code, companyId: item.companyId, found: item.savedAt, status: "found",
          description: rawOffer.description.slice(0,400), discount: typeof rawOffer.discount === "string" ? rawOffer.discount.slice(0,100) : "По условиям источника",
          conditions: Array.isArray(rawOffer.conditions) ? rawOffer.conditions.filter((value): value is string => typeof value === "string").slice(0,20).map(value => value.slice(0,500)) : [], sources,
          expiresAt: typeof rawOffer.expiresAt === "number" && Number.isFinite(rawOffer.expiresAt) ? rawOffer.expiresAt : undefined,
          verificationDetails: "Сохранённая копия. Применение не проверялось.",
        };
      }
      // Never persist a verified/official claim as a browser snapshot.
      if (!unique.has(item.id)) unique.set(item.id, { id: item.id, companyId: item.companyId, code: item.code, savedAt: item.savedAt, ...(snapshot ? { snapshot } : {}) });
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
