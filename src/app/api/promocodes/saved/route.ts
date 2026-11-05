import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toPromoCode } from "@/lib/promo-store";
import { parseSavedIds } from "@/lib/saved-promos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const ids = parseSavedIds(request.nextUrl.searchParams.get("ids"));
  const headers = { "Cache-Control": "no-store" };
  if (!ids) return NextResponse.json({ error: "Укажите от 1 до 100 корректных идентификаторов предложений." }, { status: 400, headers });
  try {
    // Saved offers stay accessible after they disappear from the general catalogue.
    // Effective expiry is recalculated instead of returning a browser's old status.
    const rows = await db.promoOffer.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map(row => [row.id, toPromoCode(row)]));
    return NextResponse.json({
      codes: ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []),
      missingIds: ids.filter(id => !byId.has(id)),
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Не удалось обновить сохранённые предложения. Попробуйте позже." }, { status: 503, headers });
  }
}
