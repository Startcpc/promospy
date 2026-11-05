import { companies } from "./companies";

export const PROMO_STATUSES = ["found", "official", "verified", "rejected", "expired", "unavailable"] as const;
export type PromoStatus = (typeof PROMO_STATUSES)[number];
export type PromoSource = { url: string; name: string; seenAt: number };
export type VerificationEvidence = {
  method: "browser" | "source";
  observedAt: number;
  message: string;
  region?: string;
  accountType?: string;
  totalBefore?: number;
  totalAfter?: number;
  cart?: string;
  sourceUrl?: string;
};
export type PromoCode = {
  id: string;
  companyId: number;
  code: string;
  description: string;
  discount: string;
  status: PromoStatus;
  sources: PromoSource[];
  found: number;
  checked?: number;
  validUntil?: number;
  invalidSince?: number;
  startsAt?: number;
  expiresAt?: number;
  minOrder?: number;
  conditions: string[];
  verificationDetails?: string;
  evidence?: VerificationEvidence;
};
export type ScanLogEntry = {
  time: number;
  text: string;
  type: "scan" | "found" | "verify" | "result" | "info" | "error";
};
export type ScanState = {
  codes: PromoCode[];
  log: ScanLogEntry[];
  status: "idle" | "queued" | "running" | "failed";
  lastScan: number | null;
  nextScan: number | null;
  error: string | null;
  officialCheckedAt?: number;
  officialError?: string;
};
export const statusLabels: Record<PromoStatus, string> = {
  found: "Не проверен", official: "На официальном сайте", verified: "Проверен в корзине", rejected: "Не подошёл при проверке",
  expired: "Срок истёк", unavailable: "Проверка недоступна",
};
export function makeLogEntry(text: string, type: ScanLogEntry["type"]): ScanLogEntry {
  return { time: Date.now(), text, type };
}
export function getCompanyById(id: number) { return companies.find((company) => company.id === id); }
// Codes can be case sensitive. Preserve their case and normalize Unicode only.
export function codeKey(code: string) { return code.trim().normalize("NFC"); }
export function effectiveStatus(code: Pick<PromoCode, "status" | "expiresAt" | "validUntil">, now = Date.now()): PromoStatus {
  if (code.expiresAt !== undefined && code.expiresAt <= now) return "expired";
  if (code.status === "verified" && (!code.validUntil || code.validUntil <= now)) return "found";
  return code.status;
}
export function matchesPromoQuery(code: PromoCode, query: string) {
  const text = [code.code, code.description, code.discount, ...code.conditions].join(" ").toLocaleLowerCase("ru");
  return query.trim().toLocaleLowerCase("ru").split(/\s+/).every((word) => text.includes(word));
}

export const INVALID_RETENTION_MS = 24 * 60 * 60 * 1000;
export function invalidSince(code: PromoCode, now = Date.now()): number | undefined {
  const status = effectiveStatus(code, now);
  if (status !== "expired" && status !== "rejected") return undefined;
  const dates = [code.invalidSince, code.expiresAt !== undefined && code.expiresAt <= now ? code.expiresAt : undefined]
    .filter((date): date is number => date !== undefined);
  return dates.length ? Math.min(...dates) : code.checked ?? code.found;
}
export function visiblePromoCodes(codes: PromoCode[], now = Date.now()): PromoCode[] {
  const priority: Record<PromoStatus, number> = { verified: 0, official: 1, found: 2, unavailable: 3, rejected: 4, expired: 4 };
  return codes.filter((code) => {
    const since = invalidSince(code, now);
    return since === undefined || now < since + INVALID_RETENTION_MS;
  }).sort((a, b) => priority[effectiveStatus(a, now)] - priority[effectiveStatus(b, now)]
    || (b.checked ?? b.found) - (a.checked ?? a.found) || a.id.localeCompare(b.id));
}

export function isActivePromo(code: PromoCode, now = Date.now()) {
  return (code.startsAt === undefined || code.startsAt <= now) && ["verified", "official"].includes(effectiveStatus(code, now));
}
