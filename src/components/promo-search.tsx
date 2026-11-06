"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PromoCard } from "./promo-card";
import { getCompanyById, visiblePromoCodes, isActivePromo, type PromoCode } from "@/lib/promocodes";

type SearchResult = { key: string; codes: PromoCode[]; hasMore: boolean; error?: string };
export function PromoSearch() {
  const [query, setQuery] = useState("");
  const [verified, setVerified] = useState(false);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<SearchResult | null>(null);
  const [now, setNow] = useState(Date.now());
  const key = JSON.stringify([query, verified, page, retry]);
  const current = data?.key === key ? data : null;
  const loading = current === null;
  useEffect(() => {
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const response = await fetch(`/api/promocodes?q=${encodeURIComponent(query)}&active=${verified ? 1 : 0}&page=${page}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Не удалось загрузить предложения");
        if (!Array.isArray(result.codes) || typeof result.hasMore !== "boolean") throw new Error("Не удалось прочитать предложения");
        if (!controller.signal.aborted) { setData({ key, codes: result.codes, hasMore: result.hasMore }); setNow(Date.now()); }
      } catch (error) {
        if (!controller.signal.aborted) setData({ key, codes: [], hasMore: false, error: error instanceof Error ? error.message : "Ошибка поиска" });
      } finally {
        if (!controller.signal.aborted) refreshTimer = setTimeout(() => { void load(); }, 30000);
      }
    };
    const timer = setTimeout(() => { void load(); }, 300);
    const clockTimer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(timer); clearTimeout(refreshTimer); clearInterval(clockTimer); controller.abort(); };
  }, [query, verified, page, key]);
  const codes = visiblePromoCodes(current?.codes ?? [], now).filter(code => !verified || isActivePromo(code, now));
  return <section className="mt-12" aria-busy={loading}>
    <p className="mb-2 text-[10px] font-bold tracking-[0.2em] text-[#c2410c]">НАЙДИТЕ ПРЕДЛОЖЕНИЕ ПОД СВОИ ПЛАНЫ</p>
    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Поиск промокодов и предложений</h2>
    <div className="my-4 flex flex-wrap items-center gap-3">
      <input aria-label="Поиск предложений" placeholder="Например: доставка, первый заказ, Ozon" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} className="min-w-48 flex-1 rounded-xl border border-[#dce7f9] bg-white px-4 py-3" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={event => { setVerified(event.target.checked); setPage(0); }} />Только актуальные</label>
    </div>
    {current?.error && <div className="rounded-xl border border-orange-200 bg-orange-50 p-4"><p role="alert" className="text-sm text-orange-900">{current.error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-medium text-orange-900">Повторить поиск</button></div>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Ищем…</p>}
    {!loading && !current?.error && codes.length === 0 && <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">Подходящие предложения пока не найдены.</p>}
    {!current?.error && <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{codes.map(code => <div key={code.id}><Link href={`/company/${code.companyId}`} className="mb-2 block text-sm font-semibold text-blue-700 underline">{getCompanyById(code.companyId)?.name}</Link><PromoCard code={code} /></div>)}</div>}
    <nav aria-label="Страницы предложений" className="mt-4 flex gap-3 text-sm">
      {page > 0 && <button disabled={loading} className="rounded-lg border px-4 py-2 disabled:opacity-40" onClick={() => setPage(value => value - 1)}>← Назад</button>}
      {current?.hasMore && !current.error && <button disabled={loading} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-40" onClick={() => setPage(value => value + 1)}>Следующие →</button>}
    </nav>
  </section>;
}
