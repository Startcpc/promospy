import { Prisma, type PrismaClient, type PromoOffer } from "@prisma/client";
import { db } from "./db";
import { codeKey, effectiveStatus, invalidSince, visiblePromoCodes, INVALID_RETENTION_MS, type PromoCode, type PromoSource, type ScanState, type ScanLogEntry, type VerificationEvidence } from "./promocodes";
import { searchCompanies } from "./search";
import type { OfficialSnapshot } from "./official-snapshot";

export const SCAN_INTERVAL = 60 * 60 * 1000;
export const RETRY_INTERVAL = 15 * 60 * 1000;
export function parseStoredJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
export function toPromoCode(row: PromoOffer): PromoCode {
  const code: PromoCode = {
    id: row.id, companyId: row.companyId, code: row.code, description: row.description, discount: row.discount,
    status: row.status as PromoCode["status"], conditions: parseStoredJson<string[]>(row.conditions, []),
    sources: parseStoredJson<PromoSource[]>(row.sources, []), found: row.foundAt.getTime(),
    checked: row.checkedAt?.getTime(), validUntil: row.validUntil?.getTime(), startsAt: row.startsAt?.getTime(),
    expiresAt: row.expiresAt?.getTime(), invalidSince: row.invalidSince?.getTime(), minOrder: row.minOrder ?? undefined,
    verificationDetails: row.verificationDetails ?? undefined, evidence: parseStoredJson<VerificationEvidence | undefined>(row.evidence, undefined),
  };
  code.status = effectiveStatus(code);
  return code;
}
export async function getScanState(companyId: number, client: PrismaClient = db, includeHidden = false): Promise<ScanState> {
  const [job, offers] = await Promise.all([
    client.promoScanJob.findUnique({ where: { companyId } }),
    client.promoOffer.findMany({ where: { companyId }, orderBy: [{ lastSeenAt: "desc" }, { code: "asc" }] }),
  ]);
  return {
    codes: includeHidden ? offers.map(toPromoCode) : visiblePromoCodes(offers.map(toPromoCode)), log: parseStoredJson<ScanLogEntry[]>(job?.log ?? null, []),
    status: (job?.state ?? "idle") as ScanState["status"], lastScan: job?.finishedAt?.getTime() ?? null,
    nextScan: job?.nextRunAt?.getTime() ?? null, error: job?.error ?? null,
    officialCheckedAt: job?.officialCheckedAt?.getTime(), officialError: job?.officialError ?? undefined,
  };
}

/** Rank and hide BEFORE pagination, including expiry that happens between worker runs. */
export async function searchPublicPromos(query: string, onlyVerified: boolean, page = 0, client: PrismaClient = db, now = Date.now(), onlyActive = false) {
  const rank = Prisma.sql`CASE WHEN "expiresAt" <= ${now} THEN 4
    WHEN "status" = 'verified' AND "validUntil" > ${now} THEN 0
    WHEN "status" = 'official' THEN 1
    WHEN "status" IN ('found', 'verified', 'official') THEN 2 WHEN "status" = 'unavailable' THEN 3 ELSE 4 END`;
  const since = Prisma.sql`CASE WHEN "expiresAt" <= ${now} THEN MIN("expiresAt", COALESCE("invalidSince", "expiresAt"))
    WHEN "status" IN ('rejected', 'expired') THEN COALESCE("invalidSince", "checkedAt", "foundAt") ELSE NULL END`;
  const filters = [Prisma.sql`(${since} IS NULL OR ${since} > ${now - INVALID_RETENTION_MS})`];
  if (onlyVerified || onlyActive) filters.push(Prisma.sql`("startsAt" IS NULL OR "startsAt" <= ${now})`);
  if (onlyVerified) filters.push(Prisma.sql`${rank} = 0`);
  if (onlyActive) filters.push(Prisma.sql`${rank} <= 1`);
  for (const word of query.trim().toLocaleLowerCase("ru").split(/\s+/).filter(Boolean)) {
    const ids = searchCompanies(word).map((company) => company.id);
    filters.push(ids.length ? Prisma.sql`(instr("searchText", ${word}) > 0 OR "companyId" IN (${Prisma.join(ids)}))`
      : Prisma.sql`instr("searchText", ${word}) > 0`);
  }
  const ids = await client.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "PromoOffer" WHERE ${Prisma.join(filters, " AND ")}
    ORDER BY ${rank}, COALESCE("checkedAt", "foundAt") DESC, "id" ASC LIMIT 31 OFFSET ${Math.floor(page) * 30}`);
  const rows = await client.promoOffer.findMany({ where: { id: { in: ids.slice(0, 30).map((row) => row.id) } } });
  const byId = new Map(rows.map((row) => [row.id, toPromoCode(row)]));
  return { codes: ids.slice(0, 30).flatMap(({ id }) => byId.has(id) ? [byId.get(id)!] : []), hasMore: ids.length > 30 };
}
export async function requestScan(companyId: number, client: PrismaClient = db) {
  const now = new Date();
  await client.promoScanJob.upsert({ where: { companyId }, create: { companyId, nextRunAt: now }, update: {} });
  // Cooldown is shared across visitors, and running/queued jobs cannot be replaced.
  await client.promoScanJob.updateMany({
    where: { companyId, state: { in: ["idle", "failed"] }, nextRunAt: { lte: now } },
    data: { state: "queued", requestedAt: now, error: null },
  });
  return getScanState(companyId, client);
}

export async function saveScanResult(companyId: number, owner: string, codes: PromoCode[], log: ScanLogEntry[], client: PrismaClient = db, official?: OfficialSnapshot) {
  await client.$transaction(async (tx) => {
    const lease = await tx.promoWorkerLease.findUnique({ where: { id: "scanner" } });
    if (lease?.owner !== owner || lease.expiresAt <= new Date()) throw new Error("Worker lease lost");
    const claimed = await tx.promoScanJob.updateMany({ where: { companyId, owner, state: "running" }, data: {
      state: "idle", owner: null, leaseUntil: null, finishedAt: new Date(), nextRunAt: new Date(Date.now() + (official?.error ? RETRY_INTERVAL : SCAN_INTERVAL)), error: null, log: JSON.stringify(log.slice(-60)),
      ...(official ? { ...(official.complete ? { officialCheckedAt: new Date(official.observedAt) } : {}), officialError: official.error ?? null } : {}),
    } });
    if (!claimed.count) throw new Error("Job ownership lost");
    for (const code of codes) {
      const key = { companyId, codeKey: codeKey(code.code) };
      const previous = await tx.promoOffer.findUnique({ where: { companyId_codeKey: key } });
      const fromOfficial = code.evidence?.method === "source" && !!code.checked;
      const sourceMap = new Map(parseStoredJson<PromoSource[]>(previous?.sources ?? null, []).map((source) => [source.url, source]));
      for (const source of code.sources) sourceMap.set(source.url, source);
      let common = {
        code: code.code, description: code.description, discount: code.discount,
        searchText: [code.code, code.description, code.discount, ...code.conditions].join(" ").toLocaleLowerCase("ru"),
        sources: JSON.stringify([...sourceMap.values()]), conditions: JSON.stringify(code.conditions),
        minOrder: code.minOrder ?? (fromOfficial ? null : previous?.minOrder ?? null), startsAt: code.startsAt ? new Date(code.startsAt) : fromOfficial ? null : previous?.startsAt ?? null,
        expiresAt: code.expiresAt ? new Date(code.expiresAt) : fromOfficial ? null : previous?.expiresAt ?? null, lastSeenAt: new Date(),
      };
      if (previous?.status === "official" && !fromOfficial) common = { ...common,
        description: previous.description, discount: previous.discount, searchText: previous.searchText,
        conditions: previous.conditions, minOrder: previous.minOrder, startsAt: previous.startsAt, expiresAt: previous.expiresAt };
      const conditionsChanged = previous && (previous.description !== common.description || previous.discount !== common.discount
        || previous.conditions !== common.conditions || previous.minOrder !== common.minOrder
        || previous.expiresAt?.getTime() !== common.expiresAt?.getTime() || previous.startsAt?.getTime() !== common.startsAt?.getTime());
      // A discovery without a new check must not erase a previous check or extend its lifetime.
      let verification: Partial<Pick<PromoOffer, "status" | "checkedAt" | "validUntil" | "verificationDetails" | "evidence">> = code.checked ? {
        status: code.status, checkedAt: new Date(code.checked), validUntil: code.validUntil ? new Date(code.validUntil) : null,
        verificationDetails: code.verificationDetails ?? null, evidence: code.evidence ? JSON.stringify(code.evidence) : null,
      } : code.status === "expired" ? { status: "expired", validUntil: null }
        : conditionsChanged ? { status: "found", validUntil: null } : {};
      const previousCode = previous ? toPromoCode(previous) : undefined;
      const previousInvalid = previousCode ? invalidSince(previousCode) : undefined;
      const renewed = !!previous?.expiresAt && !!common.expiresAt && common.expiresAt > previous.expiresAt && common.expiresAt > new Date();
      // A timeout / rediscovery cannot resurrect an invalid campaign or erase a still-fresh success.
      if (previous && !renewed && code.status !== "verified" && code.status !== "official" && code.status !== "expired" && code.status !== "rejected"
        && (previousInvalid !== undefined || (!conditionsChanged && previousCode?.status === "verified"))) verification = {};
      if (previous?.status === "official" && !fromOfficial) verification = {};
      const resultingStatus = (verification.status ?? previous?.status ?? code.status) as PromoCode["status"];
      const negative = invalidSince({ ...code, status: resultingStatus, expiresAt: common.expiresAt?.getTime(),
        invalidSince: renewed || resultingStatus === "verified" || resultingStatus === "official" ? undefined : previousInvalid });
      const retention = { invalidSince: negative === undefined ? null : new Date(negative) };
      const offer = await tx.promoOffer.upsert({ where: { companyId_codeKey: key },
        create: { ...key, ...common, status: resultingStatus, foundAt: new Date(code.found), ...retention, ...verification },
        update: { ...common, ...verification, ...retention },
      });
      if (code.checked) await tx.promoCheck.create({ data: {
        offerId: offer.id, status: code.status, checkedAt: new Date(code.checked), details: code.verificationDetails ?? "",
        evidence: code.evidence ? JSON.stringify(code.evidence) : null,
      } });
    }
    // Only a fully read official list can prove absence. A 401, timeout or partial parse cannot.
    if (official?.complete) {
      const missing = await tx.promoOffer.findMany({ where: { companyId, status: "official", codeKey: { notIn: official.codes.map((code) => codeKey(code.code)) } } });
      for (const offer of missing) {
        const details = "Код больше не найден в актуальных официальных акциях. Статус актуальности снят.";
        await tx.promoOffer.update({ where: { id: offer.id }, data: { status: "found", validUntil: null, verificationDetails: details } });
        await tx.promoCheck.create({ data: { offerId: offer.id, status: "found", checkedAt: new Date(official.observedAt), details } });
      }
    }
  }, { timeout: 20000 });
}
