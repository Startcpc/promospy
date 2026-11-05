"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { getCompanyById, matchesPromoQuery, isActivePromo, visiblePromoCodes, type ScanState } from "@/lib/promocodes";
import { PromoCard, formatPromoDate } from "@/components/promo-card";

export default function CompanyPromoPage() {
  const { id } = useParams<{ id: string }>();
  // Key isolates polling and state when navigating between merchants.
  return <CompanyResults key={id} id={Number(id)} />;
}
function CompanyResults({ id }: { id: number }) {
  const company = getCompanyById(id);
  const [state, setState] = useState<ScanState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    if (!company) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async (first = false) => {
      try {
        const response = await fetch(`/api/scan/${id}`, { method: first ? "POST" : "GET", signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить результаты");
        if (controller.signal.aborted) return;
        setState(data); setError(null); setNow(Date.now());
        timer = setTimeout(() => { void poll(); }, data.status === "running" || data.status === "queued" ? 3000 : 30000);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
        timer = setTimeout(() => { void poll(); }, 15000);
      }
    };
    void poll(true);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [company, id]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/scan/${id}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось запросить проверку"); }
    finally { setRefreshing(false); }
  };
  if (!company) return <main className="p-8"><p>Компания не найдена</p><Link href="/">На главную</Link></main>;
  const busy = state?.status === "running" || state?.status === "queued";
  const codes = visiblePromoCodes(state?.codes ?? [], now).filter((code) => matchesPromoQuery(code, query) && (!onlyVerified || isActivePromo(code, now)));
  const inCooldown = !!state?.nextScan && state.nextScan > now;
  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6">
    <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm"><ArrowLeft className="h-4 w-4" />Все компании</Link>
    <header className="mb-6 flex items-center gap-4">
      <img src={company.logo} alt="" className="h-20 w-20 rounded-2xl object-contain p-2" style={{ backgroundColor: `#${company.bgColor}` }} />
      <div><h1 className="text-3xl font-bold">Промокоды {company.name}</h1><a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm underline">Сайт магазина</a></div>
    </header>
    <p className="mb-4 text-sm text-muted-foreground">{id === 301 ? "Регион проверки: Москва. " : ""}Актуальные предложения выше. Истёкшие и отклонённые скрываются через 24 часа.</p>
    <section className="mb-6 rounded-2xl border p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">{state?.status === "running" ? "Проверяем источники и условия" : state?.status === "queued" ? "Обновление в очереди" : "Сохранённые промокоды"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{state?.lastScan ? `Последнее завершённое обновление: ${formatPromoDate(state.lastScan)} МСК` : "Первое обновление ещё не завершено"}</p>
          {state?.nextScan && !busy && <p className="mt-1 text-xs text-muted-foreground">Следующее обновление: {formatPromoDate(state.nextScan)} МСК</p>}
        </div>
        <button onClick={refresh} disabled={busy || refreshing || inCooldown} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Обновить</button>
      </div>
      {(error || state?.error) && <p role="alert" className="mt-3 text-sm text-amber-700">{error || state?.error}</p>}
      {state?.officialError && <p role="alert" className="mt-2 text-sm text-amber-700">Ошибка официального источника: {state.officialError}</p>}
      {state?.officialCheckedAt && <p className="mt-2 text-xs text-muted-foreground">Последнее успешное чтение официальных акций: {formatPromoDate(state.officialCheckedAt)} МСК. {state.officialError ? "Не удалось обновить источник. Сохраняем последний подтверждённый статус; дата успешной проверки указана в карточке." : "Публичные акции проверены без входа в аккаунт."}</p>}
      {state && state.log.length > 0 && <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Ход обновления</summary><div className="mt-2 max-h-40 space-y-1 overflow-auto">{state.log.map((entry, index) => <p key={`${entry.time}-${index}`}>{entry.text}</p>)}</div></details>}
    </section>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input aria-label="Поиск по промокодам и условиям" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Код, скидка или условия акции" className="min-w-48 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyVerified} onChange={(event) => setOnlyVerified(event.target.checked)} />Только актуальные</label>
    </div>
    {!state && !error ? <p className="py-10 text-center text-muted-foreground">Загружаем результаты…</p>
      : codes.length ? <div className="grid gap-4 sm:grid-cols-2">{codes.map((code) => <PromoCard key={code.id} code={code} />)}</div>
        : <p className="py-10 text-center text-muted-foreground">{query || onlyVerified ? "Нет промокодов по выбранным условиям." : busy ? "Промокоды появятся после обработки источников." : "Промокоды пока не найдены. Новые предложения появятся после следующего обновления."}</p>}
    <section className="mt-8 rounded-2xl border p-4"><h2 className="mb-2 font-semibold">О компании</h2><p className="text-sm text-muted-foreground">{company.description}</p></section>
  </main>;
}
