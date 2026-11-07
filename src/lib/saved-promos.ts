import { getCompanyById, type PromoCode } from "./promocodes";

import { validSourceUrl } from "./promo-validation";

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
          return !!source && validSourceUrl(source.url);
        }).slice(0,10).map(source => ({ url: source.url, name: new URL(source.url).hostname, seenAt: typeof source.seenAt === "number" && Number.isFinite(source.seenAt) && source.seenAt >= 0 ? source.seenAt : item.savedAt as number })) : [];
        snapshot = { id: item.id, code: item.code, companyId: item.companyId, found: typeof rawOffer.found === "number" && Number.isFinite(rawOffer.found) && rawOffer.found >= 0 ? rawOffer.found : item.savedAt, status: "found",
          description: rawOffer.description.slice(0,400), discount: typeof rawOffer.discount === "string" ? rawOffer.discount.slice(0,100) : "По условиям источника",
          conditions: Array.isArray(rawOffer.conditions) ? rawOffer.conditions.filter((value): value is string => typeof value === "string").slice(0,20).map(value => value.slice(0,500)) : [], sources,
          expiresAt: typeof rawOffer.expiresAt === "number" && Number.isFinite(rawOffer.expiresAt) ? rawOffer.expiresAt : undefined,
          startsAt: typeof rawOffer.startsAt === "number" && Number.isFinite(rawOffer.startsAt) && rawOffer.startsAt >= 0 ? rawOffer.startsAt : undefined,
          minOrder: typeof rawOffer.minOrder === "number" && Number.isFinite(rawOffer.minOrder) && rawOffer.minOrder >= 0 ? rawOffer.minOrder : undefined,
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
  if (!raw || raw.length > MAX_SAVED_PROMOS * 257) return null;
  const ids = raw.split(",");
  if (ids.length > MAX_SAVED_PROMOS || !ids.every(validOfferId)) return null;
  return [...new Set(ids)];
}

/** Bound the encoded GET URL, including Cyrillic and non-BMP coupon codes. */
export function savedIdBatches(ids: string[], limit = 2000): string[] {
  const batches: string[] = []; let current = '';
  for (const id of ids) {
    const next = current ? `${current},${id}` : id;
    if (current && encodeURIComponent(next).length > limit) {batches.push(current);current=id;} else current=next;
  }
  if (current) batches.push(current);
  return batches;
}
