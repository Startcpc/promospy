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
import { APP_VERSION } from "@/lib/app-version";

function sourceFailureMessage(source:{outcome?:string;httpStatus?:number;errorCode?:string;message?:string}){
  if(source.outcome==='skipped'||source.outcome==='blocked')return 'Пропущен: '+(source.message??'источник ограничил доступ');
  if(source.errorCode==='robots')return source.message??'Не удалось загрузить правила сайта';
  if(source.httpStatus===401)return 'Этот адрес требует авторизацию';
  if(source.httpStatus===403)return 'Сайт отклонил запрос';
  if(source.httpStatus===404)return 'Страница не найдена';
  return source.message??'Не удалось прочитать источник';
}

const emptyState:MerchantSearchState={codes:[],status:'idle',lastScan:null,nextScan:null,error:null,log:[]};
export function CompanyResults({ id }: { id: number }) {
  const company = getCompanyById(id);
  const [state, setState] = useState<MerchantSearchState>(emptyState);
  const [requested, setRequested] = useState(false);
  const requestedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
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
      if(!requestedRef.current)return;
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
        const response = await fetch(`/api/scan/${id}?fresh=1${force ? "&refresh=1" : ""}`, {
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
    requestRef.current = force => {
      requestedRef.current=true;setRequested(true);setStarting(true);setError(null);setState(emptyState);
      return sync("POST",force);
    };
    const stopWatching = watchPageActivity(()=>{setNow(Date.now());void sync(pendingForce?"POST":"GET",pendingForce);},()=>{
      setOffline(navigator.onLine===false);clearTimeout(timer);sequence++;activeRequest?.abort();activeRequest?.dispose();activeRequest=undefined;setRefreshing(false);
    });
    // Opening, prefetching and resuming the page cannot start the first search.
    return () => { stopWatching();controller.abort(); clearTimeout(timer); requestRef.current = null; };
  }, [company, id]);
  const refresh = () => { void requestRef.current?.(true); };
  if (!company) return <main className="p-8"><p>Компания не найдена</p><Link href="/">На главную</Link></main>;
  const busy = !error && !offline && (starting || state?.status === "running" || state?.status === "queued");
  const codes = visiblePromoCodes(state?.codes ?? [], now).filter((code) => matchesPromoQuery(code, query) && (!activeOnly || effectiveStatus(code, now) !== "expired" && (code.startsAt === undefined || code.startsAt <= now)));
  const sourceKeys=new Set<string>();
  const sources=state.report?.sourceResults?.filter(source=>{
    const key=source.outcome==='blocked'||source.outcome==='skipped'
      ?[new URL(source.failureUrl??source.url).hostname,source.errorCode,source.httpStatus,source.message].join('|'):source.url;
    if(sourceKeys.has(key))return false;sourceKeys.add(key);return true;
  });
  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6">
    <nav aria-label="Навигация" className="mb-5 flex flex-wrap items-center justify-between gap-3">
    <Link href="/" className="inline-flex items-center gap-2 text-sm"><ArrowLeft className="h-4 w-4" />На главную</Link>
    <SavedPromosLink />
    </nav>
    <header className="mb-6 flex items-center gap-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg p-2" style={{ backgroundColor: `#${company.bgColor}` }}><BrandLogo key={company.logo} src={company.logo} name={company.name} accentColor={company.color} /></div>
      <div className="min-w-0"><h1 className="text-2xl font-bold sm:text-3xl">Промокоды {company.name}</h1><a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm underline">Сайт магазина</a></div>
    </header>
    <p className="mb-4 text-base text-muted-foreground">Ищем в открытых источниках. Закрытые сайты пропускаем.</p>
    <section className="scan-panel mb-6 border-2 border-[#16213e] bg-white p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-bold">{state.status === "queued" ? "Поиск начнётся автоматически…" : busy ? state.report?.phase === "sources" ? "Ищем на других сайтах…" : "Проверяем официальный сайт…" : "Промокоды"}</p>
        <button onClick={refresh} disabled={busy || refreshing || offline} className="retro-button inline-flex items-center gap-2 border-2 border-[#16213e] bg-[#ff6b24] px-4 py-2 font-bold text-[#16213e] disabled:opacity-40"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />{busy || refreshing ? "Обновляем…" : "Обновить"}</button>
      </div>
      {offline && <p role="status" className="mt-3 text-sm text-muted-foreground">Нет подключения. Поиск доступен после подключения.</p>}
      {error && codes.length > 0 && <p role="status" className="mt-3 text-sm text-muted-foreground">Повторяем загрузку. Сохранённые предложения остаются на экране.</p>}
      {state.notice && codes.length > 0 && <p role="status" className="mt-3 text-sm text-muted-foreground">{state.notice}</p>}
      {state?.report && <p className="mt-3 text-base">Найдено: {state.report.couponsFound ?? state.codes.length} · Прочитано страниц: {state.report.pagesRead}.</p>}
      <p className="mt-2 text-sm text-muted-foreground">После нажатия «Обновить» — автообновление каждые 5 минут, пока сервер запущен.</p>
      {state && <details className="mt-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-medium">Подробнее об обновлении</summary>
        <div className="mt-3 space-y-2">
          <p>PromoSpy {APP_VERSION}</p>
          {state.report && <p>Официальных кодов: {state.report.officialCoupons ?? 0} · Пропущено из-за ограничений: {(state.report.pagesBlocked ?? 0)+(state.report.pagesSkipped ?? 0)} · Ошибок разбора: {state.report.parseFailures ?? 0}</p>}
          {state.report?.budget && <p>Страниц проверено по бюджету: {state.report.budget.pagesUsed} из {state.report.budget.pages}. Индексы и карты: {state.report.budget.discoveryUsed} из {state.report.budget.discoveryRequests}.</p>}
          {state.report?.discovery?.map((provider,index)=><p key={provider.url+index}>{provider.provider}: {provider.outcome === "ok" ? `найдено ссылок ${provider.found}` : provider.message ?? "индекс не прочитан"}</p>)}
          {state.lastScan && <p>Результаты получены: {formatPromoDate(state.lastScan)} МСК</p>}
          {error && <p>{error}</p>}
          {sources?.map(source => <p key={source.url}><a href={source.failureUrl??source.finalUrl??source.url} title={source.failureUrl??source.finalUrl??source.url} target="_blank" rel="noopener noreferrer" className="underline">{new URL(source.failureUrl??source.finalUrl??source.url).hostname}</a>: {source.outcome === "codes" ? `найдено ${source.count}` : source.outcome === "empty" ? "на странице указано, что промокодов нет" : source.outcome === "index" ? "страница магазина" : sourceFailureMessage(source)}{source.httpStatus ? ` · ${source.errorCode === "robots" ? "robots.txt: " : ""}HTTP ${source.httpStatus}` : ""}{source.rendering === "unavailable" ? " · локальный браузер недоступен" : ""}</p>)}
          {!state.report?.sourceResults && state.report?.issues?.map(issue => <p key={issue.url}>{new URL(issue.url).hostname}: {issue.reason}</p>)}
          <p>Истёкшие и отклонённые коды скрываются через 24 часа.</p>
          {state.report && <p>Доменов в поиске: {state.report.targetSites}. Страницы найдены на {state.report.discoveredSites}.</p>}
          {state.report?.warnings.map(warning => <p key={warning}>{warning}</p>)}
          {state.log.length > 0 && <details><summary className="cursor-pointer">Журнал</summary><div className="mt-2 max-h-40 space-y-1 overflow-auto">{state.log.map((entry,index) => <p key={`${entry.time}-${index}`}>{entry.text}</p>)}</div></details>}
        </div>
      </details>}
    </section>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input aria-label="Поиск по промокодам и условиям" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Код, скидка или условия акции" className="min-w-48 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />Без истёкших</label>
    </div>
    {!state && !error ? <p className="py-10 text-center text-muted-foreground">Загружаем результаты…</p>
      : codes.length ? <div className="grid gap-4 sm:grid-cols-2">{codes.map((code) => <PromoCard key={code.id} code={code} />)}</div>
        : <p role="status" className="py-10 text-center text-muted-foreground">{!requested ? "Нажмите «Обновить», чтобы найти промокоды." : offline ? "Подключитесь к интернету, чтобы найти новые промокоды." : busy ? "Найденные коды появятся здесь автоматически." : error ? "Не удалось загрузить результаты. Повторяем запрос." : state.status === "failed" ? state.notice : query || state.codes.length ? "Нет промокодов по выбранным условиям." : "В прочитанных источниках открытые промокоды не найдены."}</p>}
    <details className="mt-8 border-t pt-4"><summary className="cursor-pointer text-base font-bold">О компании</summary><p className="mt-3 text-base text-muted-foreground">{company.description}</p></details>
  </main>;
}
