import { NextRequest, NextResponse } from "next/server";
import { getCompanyById } from "@/lib/promocodes";
import { getScanState, requestScan } from "@/lib/promo-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

async function handle(request: NextRequest, context: Context, enqueue: boolean) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id) || !getCompanyById(Number(id))) return NextResponse.json({ error: "Компания не найдена" }, { status: 404 });
  if (enqueue) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  }
  try {
    const state = await (enqueue ? requestScan(Number(id)) : getScanState(Number(id)));
    return NextResponse.json(state, { status: enqueue && (state.status === "queued" || state.status === "running") ? 202 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Promo API:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Хранилище временно недоступно. Попробуйте позже." }, { status: 503 });
  }
}
export async function GET(request: NextRequest, context: Context) { return handle(request, context, false); }
export async function POST(request: NextRequest, context: Context) { return handle(request, context, true); }
