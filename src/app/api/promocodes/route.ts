import { NextRequest, NextResponse } from "next/server";
import { searchPublicPromos } from "@/lib/promo-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200).toLocaleLowerCase("ru");
  const onlyVerified = request.nextUrl.searchParams.get("verified") === "1";
  const onlyActive = request.nextUrl.searchParams.get("active") === "1";
  const page = Math.max(0, Math.min(1000, Number(request.nextUrl.searchParams.get("page")) || 0));
  try {
    return NextResponse.json(await searchPublicPromos(query, onlyVerified, page, undefined, Date.now(), onlyActive), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Поиск временно недоступен" }, { status: 503 });
  }
}
