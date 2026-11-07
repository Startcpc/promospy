"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { getCompanyById, matchesPromoQuery, effectiveStatus, visiblePromoCodes } from "@/lib/promocodes";
import type { MerchantSearchState } from "@/lib/search-store";
import { BrandLogo } from "@/components/brand-logo";
import { SavedPromosLink } from "@/components/saved-promos-link";
import { PromoCard, formatPromoDate } from "@/components/promo-card";
import { browserRequestSignal } from "@/lib/browser-request";
import { canRequestFromPage, watchPageActivity } from "@/lib/page-activity";

export function CompanyResults({ id, initialState }: { id: number; initialState: MerchantSearchState }) {
  const company = getCompanyById(id);
  const [state, setState] = useState<MerchantSearchState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(!initialState.lastScan);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now());
  const requestRef = useRef<((force: boolean) => Promise<void>) | null>(null);
  useEffect(() => { const timer = setInterval(() => {if(!document.hidden)setNow(Date.now());}, 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!company) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let sequence = 0;
    let pendingForce = false;
    let activeRequest: ReturnType<typeof browserRequestSignal> | undefined;
    const sync = async (method: "GET" | "POST", force = false) => {
      clearTimeout(timer);
      setOffline(navigator.onLine === false);
      if(force)pendingForce=true;
      if(!canRequestFromPage())return;
      const request = ++sequence;
      activeRequest?.abort();activeRequest?.dispose();
      if (force) setRefreshing(true);
      const bounded = browserRequestSignal(controller.signal, 12000);
      activeRequest=bounded;
      try {
        const response = await fetch(`/api/scan/${id}${force ? "?refresh=1" : ""}`, {
          method, signal: bounded.signal, cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Ошибка загрузки");
        if (controller.signal.aborted || request !== sequence) return;
        setState(data); setError(null); setNow(Date.now()); setStarting(false);
        pendingForce=false;
        const remaining = data.nextScan == null ? null : data.nextScan - (data.serverTime ?? Date.now());
        const dueAt = remaining === null ? null : performance.now()+remaining;
        const delay = data.status === "running" || data.status === "queued" ? 750 : remaining !== null ? Math.max(1000, Math.min(30000, remaining)) : 30000;
        timer = setTimeout(() => {
          const due = (data.status === "failed" || data.status === "idle") && dueAt !== null && performance.now() >= dueAt;
          void sync(due ? "POST" : "GET");
        }, delay);
      } catch (err) {
        if (controller.signal.aborted || request !== sequence) return;
        setError(err instanceof Error ? err.message : "Ошибка загрузки"); setStarting(false);
        timer = setTimeout(() => { void sync(method, force); }, 3000);
      } finally { bounded.dispose(); if (!controller.signal.aborted && request === sequence) {activeRequest=undefined;setRefreshing(false);} }
    };
    requestRef.current = force => sync("POST", force);
    const stopWatching = watchPageActivity(()=>{setNow(Date.now());void sync("POST",pendingForce);},()=>{
      setOffline(navigator.onLine===false);clearTimeout(timer);sequence++;activeRequest?.abort();activeRequest?.dispose();activeRequest=undefined;setRefreshing(false);
    });
    // Only mounting the selected merchant starts work. Prefetching is read-only.
    void sync("POST");
    return () => { stopWatching();controller.abort(); clearTimeout(timer); requestRef.current = null; };
  }, [company, id]);
  const refresh = () => { void requestRef.current?.(true); };
  if (!company) return <main className="p-8"><p>Компания не найдена</p><Link href="/">На главную</Link></main>;
  const busy = !error && !offline && (starting || state?.status === "running" || state?.status === "queued");
  const codes = visiblePromoCodes(state?.codes ?? [], now).filter((code) => matchesPromoQuery(code, query) && (!onlyVerified || effectiveStatus(code, now) !== "expired" && (code.startsAt === undefined || code.startsAt <= now)));
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
        <button onClick={refresh} disabled={busy || refreshing || offline} className="retro-button inline-flex items-center gap-2 border-2 border-[#16213e] bg-[#ff6b24] px-4 py-2 font-bold text-[#16213e] disabled:opacity-40"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />{busy || refreshing ? "Обновляем…" : "Обновить"}</button>
      </div>
      {offline && <p role="status" className="mt-3 text-sm text-muted-foreground">Нет подключения. Сохранённые коды доступны; поиск продолжится после подключения.</p>}
      {error && codes.length > 0 && <p role="status" className="mt-3 text-sm text-muted-foreground">Повторяем загрузку. Сохранённые предложения остаются на экране.</p>}
      {state.notice && codes.length > 0 && <p role="status" className="mt-3 text-sm text-muted-foreground">{state.notice}</p>}
      {state?.report && <p className="mt-3 text-base">Прочитано страниц: {state.report.pagesRead}.</p>}
      {state && <details className="mt-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-medium">Подробнее об обновлении</summary>
        <div className="mt-3 space-y-2">
          {state.lastScan && <p>Результаты получены: {formatPromoDate(state.lastScan)} МСК</p>}
          {error && <p>{error}</p>}
          {state.report?.sourceResults?.map(source => <p key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{new URL(source.url).hostname}</a>: {source.outcome === "codes" ? `найдено ${source.count}` : source.outcome === "empty" ? "на странице указано, что промокодов нет" : source.outcome === "index" ? "страница магазина" : source.message ?? "не удалось разобрать"}</p>)}
          {!state.report?.sourceResults && state.report?.issues?.map(issue => <p key={issue.url}>{new URL(issue.url).hostname}: {issue.reason}</p>)}
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
        : <p role="status" className="py-10 text-center text-muted-foreground">{offline ? "Подключитесь к интернету, чтобы найти новые промокоды." : busy ? "Найденные коды появятся здесь автоматически." : error ? "Не удалось загрузить результаты. Повторяем запрос." : state.status === "failed" ? state.notice : query || state.codes.length ? "Нет промокодов по выбранным условиям." : "В прочитанных источниках открытые промокоды не найдены."}</p>}
    <details className="mt-8 border-t pt-4"><summary className="cursor-pointer text-base font-bold">О компании</summary><p className="mt-3 text-base text-muted-foreground">{company.description}</p></details>
  </main>;
}
