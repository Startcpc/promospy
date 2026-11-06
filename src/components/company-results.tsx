"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { getCompanyById, matchesPromoQuery, effectiveStatus, visiblePromoCodes } from "@/lib/promocodes";
import type { MerchantSearchState } from "@/lib/search-store";
import { BrandLogo } from "@/components/brand-logo";
import { SavedPromosLink } from "@/components/saved-promos-link";
import { PromoCard, formatPromoDate } from "@/components/promo-card";

export function CompanyResults({ id, initialState }: { id: number; initialState: MerchantSearchState }) {
  const company = getCompanyById(id);
  const [state, setState] = useState<MerchantSearchState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(!initialState.lastScan);
  const [now, setNow] = useState(Date.now());
  const requestRef = useRef<((force: boolean) => Promise<void>) | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!company) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let sequence = 0;
    const sync = async (method: "GET" | "POST", force = false) => {
      clearTimeout(timer);
      const request = ++sequence;
      if (force) setRefreshing(true);
      try {
        const response = await fetch(`/api/scan/${id}${force ? "?refresh=1" : ""}`, {
          method, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Ошибка загрузки");
        if (controller.signal.aborted || request !== sequence) return;
        setState(data); setError(null); setNow(Date.now()); setStarting(false);
        const delay = data.status === "running" || data.status === "queued" ? 750 : data.status === "failed" ? Math.max(1000, (data.nextScan ?? Date.now() + 60000) - Date.now()) : 30000;
        timer = setTimeout(() => { void sync(data.status === "failed" ? "POST" : "GET"); }, delay);
      } catch (err) {
        if (controller.signal.aborted || request !== sequence) return;
        setError(err instanceof Error ? err.message : "Ошибка загрузки"); setStarting(false);
        timer = setTimeout(() => { void sync(method); }, 3000);
      } finally { if (!controller.signal.aborted && request === sequence) setRefreshing(false); }
    };
    requestRef.current = force => sync("POST", force);
    // Only mounting the selected merchant starts work. Prefetching is read-only.
    void sync("POST");
    return () => { controller.abort(); clearTimeout(timer); requestRef.current = null; };
  }, [company, id]);
  const refresh = () => { void requestRef.current?.(true); };
  if (!company) return <main className="p-8"><p>Компания не найдена</p><Link href="/">На главную</Link></main>;
  const busy = starting || state?.status === "running" || state?.status === "queued";
  const codes = visiblePromoCodes(state?.codes ?? [], now).filter((code) => matchesPromoQuery(code, query) && (!onlyVerified || effectiveStatus(code, now) !== "expired"));
  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6">
    <nav aria-label="Навигация" className="mb-5 flex flex-wrap items-center justify-between gap-3">
    <Link href="/" className="inline-flex items-center gap-2 text-sm"><ArrowLeft className="h-4 w-4" />Все компании</Link>
    <SavedPromosLink />
    </nav>
    <header className="mb-6 flex items-center gap-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg p-2" style={{ backgroundColor: `#${company.bgColor}` }}><BrandLogo key={company.logo} src={company.logo} name={company.name} accentColor={company.color} /></div>
      <div><h1 className="text-3xl font-bold">Промокоды {company.name}</h1><a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm underline">Сайт магазина</a></div>
    </header>
    {id === 302 && <aside className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p>Купоны для кассы и киоска. Участие зависит от кафе; для агрегаторов доставки не действуют.</p>
      <a href="https://www.kartoshka.com/actions/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-medium underline">Открыть официальные купоны и условия</a>
    </aside>}
    <p className="mb-4 text-base text-muted-foreground">Сначала официальный сайт, затем другие источники.</p>
    <section className="scan-panel mb-6 border-2 border-[#16213e] bg-white p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-bold">{state.status === "queued" ? "Поиск начнётся автоматически…" : busy ? state.report?.phase === "sources" ? "Ищем на других сайтах…" : "Проверяем официальный сайт…" : "Промокоды"}</p>
        <button onClick={refresh} disabled={busy || refreshing} className="retro-button inline-flex items-center gap-2 border-2 border-[#16213e] bg-[#ff6b24] px-4 py-2 font-bold text-[#16213e] disabled:opacity-40"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />{busy || refreshing ? "Обновляем…" : "Обновить"}</button>
      </div>
      {error && <p role="status" className="mt-3 text-sm text-muted-foreground">Повторяем загрузку. Сохранённые предложения остаются на экране.</p>}
      {state.notice && <p role="status" className="mt-3 text-sm text-muted-foreground">{state.notice}</p>}
      {state?.report && <p className="mt-3 text-base">Прочитано страниц: {state.report.pagesRead}.</p>}
      {state && <details className="mt-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-medium">Подробнее об обновлении</summary>
        <div className="mt-3 space-y-2">
          {state.lastScan && <p>Результаты получены: {formatPromoDate(state.lastScan)} МСК</p>}
          {error && <p>{error}</p>}
          {state.report?.issues?.map(issue => <p key={issue.url}>{new URL(issue.url).hostname}: {issue.reason}</p>)}
          <p>Истёкшие и отклонённые коды скрываются через 24 часа.</p>
          {state.report && <p>Сайтов к чтению: {state.report.discoveredSites}. Цель — до {state.report.targetSites}.</p>}
          {state.report?.warnings.map(warning => <p key={warning}>{warning}</p>)}
          {state.log.length > 0 && <details><summary className="cursor-pointer">Журнал</summary><div className="mt-2 max-h-40 space-y-1 overflow-auto">{state.log.map((entry,index) => <p key={`${entry.time}-${index}`}>{entry.text}</p>)}</div></details>}
        </div>
      </details>}
    </section>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input aria-label="Поиск по промокодам и условиям" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Код, скидка или условия акции" className="min-w-48 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyVerified} onChange={(event) => setOnlyVerified(event.target.checked)} />Без истёкших</label>
    </div>
    {!state && !error ? <p className="py-10 text-center text-muted-foreground">Загружаем результаты…</p>
      : codes.length ? <div className="grid gap-4 sm:grid-cols-2">{codes.map((code) => <PromoCard key={code.id} code={code} />)}</div>
        : <p className="py-10 text-center text-muted-foreground">{query || onlyVerified ? "Нет промокодов по выбранным условиям." : busy ? "Найденные коды появятся здесь автоматически." : "Открытых промокодов пока не найдено. Можно посмотреть акции на сайте магазина."}</p>}
    <details className="mt-8 border-t pt-4"><summary className="cursor-pointer text-base font-bold">О компании</summary><p className="mt-3 text-base text-muted-foreground">{company.description}</p></details>
  </main>;
}
