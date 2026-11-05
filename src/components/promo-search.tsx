"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PromoCard } from "./promo-card";
import { getCompanyById, visiblePromoCodes, isActivePromo, type PromoCode } from "@/lib/promocodes";

export function PromoSearch() {
  const [query, setQuery] = useState("");
  const [verified, setVerified] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ codes: PromoCode[]; hasMore: boolean } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout>;
    const load = async (first = false) => {
      if (first) setLoading(true);
      try {
        const response = await fetch(`/api/promocodes?q=${encodeURIComponent(query)}&active=${verified ? 1 : 0}&page=${page}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!controller.signal.aborted) { setData(result); setError(""); setNow(Date.now()); }
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Ошибка поиска"); }
      finally { if (!controller.signal.aborted) { setLoading(false); refreshTimer = setTimeout(() => { void load(); }, 30000); } }
    };
    const timer = setTimeout(() => { void load(true); }, 300);
    const clockTimer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(timer); clearTimeout(refreshTimer); clearInterval(clockTimer); controller.abort(); };
  }, [query, verified, page]);
  const codes = visiblePromoCodes(data?.codes ?? [], now).filter((code) => !verified || isActivePromo(code, now));
  return <section className="mt-10 border-t pt-6">
    <h2 className="text-xl font-bold">Поиск промокодов и предложений</h2>
    <div className="my-4 flex flex-wrap items-center gap-3">
      <input aria-label="Поиск предложений" placeholder="Например: доставка, первый заказ, Ozon" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} className="min-w-48 flex-1 rounded-lg border bg-background px-3 py-2" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={(event) => { setVerified(event.target.checked); setPage(0); }} />Только актуальные</label>
    </div>
    {error && <p role="alert" className="text-sm text-amber-700">{error}</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Ищем…</p>}
    {!loading && !error && codes.length === 0 && <p className="text-sm text-muted-foreground">Подходящие предложения пока не найдены.</p>}
    {!error && <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{codes.map((code) => <div key={code.id}><Link href={`/company/${code.companyId}`} className="mb-2 block text-sm font-semibold underline">{getCompanyById(code.companyId)?.name}</Link><PromoCard code={code} /></div>)}</div>}
    <div className="mt-4 flex gap-4 text-sm">
      {page > 0 && <button disabled={loading} onClick={() => setPage(page - 1)}>← Назад</button>}
      {data?.hasMore && <button disabled={loading} onClick={() => setPage(page + 1)}>Следующие →</button>}
    </div>
  </section>;
}
