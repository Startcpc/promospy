"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { getCompanyById, matchesPromoQuery, isActivePromo, visiblePromoCodes, type ScanState } from "@/lib/promocodes";
import { BrandLogo } from "@/components/brand-logo";
import { SavedPromosLink } from "@/components/saved-promos-link";
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
    <section className="scan-panel mb-6 border-2 border-[#16213e] bg-white p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-bold">{state?.status === "running" ? "Обновляем…" : state?.status === "queued" ? "В очереди" : "Промокоды"}</p>
        <button onClick={refresh} disabled={busy || refreshing || inCooldown} className="retro-button inline-flex items-center gap-2 border-2 border-[#16213e] bg-[#ff6b24] px-4 py-2 font-bold text-[#16213e] disabled:opacity-40"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Обновить</button>
      </div>
      {error && <p role="alert" className="mt-3 text-base text-orange-900">{error}</p>}
      {(state?.officialError || state?.error) && <p role="status" className="mt-3 text-base text-orange-900">Не удалось обновить. Показываем сохранённые коды.</p>}
      {state && <details className="mt-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-medium">Подробнее об обновлении</summary>
        <div className="mt-3 space-y-2">
          {state.lastScan && <p>Последняя попытка: {formatPromoDate(state.lastScan)} МСК</p>}
          {state.nextScan && <p>Следующая: {formatPromoDate(state.nextScan)} МСК</p>}
          {state.officialCheckedAt && <p>Последнее успешное чтение: {formatPromoDate(state.officialCheckedAt)} МСК</p>}
          {state.officialError && <p>Ошибка источника: {state.officialError}</p>}
          {state.error && <p>{state.error}</p>}
          {id === 301 && <p>Регион проверки: Москва.</p>}
          <p>Истёкшие и отклонённые коды скрываются через 24 часа.</p>
          {state.log.length > 0 && <details><summary className="cursor-pointer">Журнал</summary><div className="mt-2 max-h-40 space-y-1 overflow-auto">{state.log.map((entry,index) => <p key={`${entry.time}-${index}`}>{entry.text}</p>)}</div></details>}
        </div>
      </details>}
    </section>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input aria-label="Поиск по промокодам и условиям" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Код, скидка или условия акции" className="min-w-48 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyVerified} onChange={(event) => setOnlyVerified(event.target.checked)} />Только актуальные</label>
    </div>
    {!state && !error ? <p className="py-10 text-center text-muted-foreground">Загружаем результаты…</p>
      : codes.length ? <div className="grid gap-4 sm:grid-cols-2">{codes.map((code) => <PromoCard key={code.id} code={code} />)}</div>
        : <p className="py-10 text-center text-muted-foreground">{query || onlyVerified ? "Нет промокодов по выбранным условиям." : busy ? "Промокоды появятся после обработки источников." : "Промокоды пока не найдены. Новые предложения появятся после следующего обновления."}</p>}
    <details className="mt-8 border-t pt-4"><summary className="cursor-pointer text-base font-bold">О компании</summary><p className="mt-3 text-base text-muted-foreground">{company.description}</p></details>
  </main>;
}
