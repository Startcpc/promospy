import type { PromoCode } from "./promocodes";

export type OfficialSnapshot = { codes: PromoCode[]; complete: boolean; observedAt: number; error?: string };
