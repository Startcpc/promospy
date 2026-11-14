"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, RefreshCw, Search } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PromoCard, formatPromoDate } from "@/components/promo-card";
import { SavePromoButton } from "@/components/save-promo-button";
import { useSavedPromos } from "@/hooks/use-saved-promos";
import { getCompanyById, effectiveStatus, type PromoCode } from "@/lib/promocodes";

import { savedIdBatches, resolveSavedOffer } from "@/lib/saved-promos";
import { browserRequestSignal } from "@/lib/browser-request";
import { FavoritesTransfer } from "@/components/favorites-transfer";
import { canRequestFromPage, watchPageActivity } from "@/lib/page-activity";

type Lookup = { key: string; codes?: PromoCode[]; error?: string; loadedAt?: number };
export default function SavedPage() {
  const { items, hydrated } = useSavedPromos();
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [retry, setRetry] = useState(0);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [now, setNow] = useState(Date.now());
  const [offline, setOffline] = useState(false);
  const idsKey = items.map(item => item.id).join(",");
  const requestKey = `${idsKey}:${retry}`;
  const current = lookup?.key === requestKey ? lookup : null;
  const loading = !!items.length && !current && !offline;

  useEffect(() => {
    const timer = setInterval(() => {if(!document.hidden)setNow(Date.now());}, 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!idsKey) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let sequence = 0;
    let activeRequest: ReturnType<typeof browserRequestSignal> | undefined;
    const load = async () => {
      clearTimeout(timer);setOffline(navigator.onLine===false);
      if(!canRequestFromPage())return;
      const request=++sequence;activeRequest?.abort();activeRequest?.dispose();
      const bounded = browserRequestSignal(controller.signal, 15000);
      activeRequest=bounded;
      try {
        const batches = savedIdBatches(idsKey.split(','));
        const codes: PromoCode[] = []; let cursor = 0;
        const signal = bounded.signal;
        await Promise.all(Array.from({length:Math.min(4,batches.length)},async () => {
          while (cursor < batches.length) {
            const batch = batches[cursor++];
            if (signal.aborted) throw new Error("Запрос отменён или превышено время ожидания.");
            const response = await fetch(`/api/promocodes/saved?ids=${encodeURIComponent(batch)}`, {cache:'no-store',signal});
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Не удалось обновить избранное.");
            if (!Array.isArray(result.codes)) throw new Error("Не удалось прочитать сохранённые предложения.");
            codes.push(...result.codes);
          }
        }));
        if (!controller.signal.aborted && request===sequence) setLookup({ key: requestKey, codes, loadedAt: Date.now() });
      } catch (error) {
        bounded.abort();
        if (!controller.signal.aborted && request===sequence) setLookup({ key: requestKey, error: error instanceof Error ? error.message : "Не удалось обновить избранное." });
      } finally {
        bounded.dispose();
        if (!controller.signal.aborted && request===sequence) {activeRequest=undefined;timer = setTimeout(() => { void load(); }, 30000);}
      }
    };
    const stopWatching=watchPageActivity(()=>{setNow(Date.now());void load();},()=>{
      setOffline(navigator.onLine===false);clearTimeout(timer);sequence++;activeRequest?.abort();activeRequest?.dispose();activeRequest=undefined;
    });
    void load();
    return () => { stopWatching();controller.abort(); clearTimeout(timer); };
  }, [idsKey, requestKey]);

  const filtered = items.filter(item => {
    const offer = resolveSavedOffer(item,current?.codes??[]) ?? item.snapshot;
    if (activeOnly && (!offer || effectiveStatus(offer, now) === "expired" || offer.startsAt !== undefined && offer.startsAt > now)) return false;
    const terms = [item.code, getCompanyById(item.companyId)?.name ?? "", offer?.description ?? "", offer?.discount ?? "", ...(offer?.conditions ?? [])].join(" ").toLocaleLowerCase("ru");
    return query.trim().toLocaleLowerCase("ru").split(/\s+/).every(word => terms.includes(word));
  });
  return <><SiteHeader back /><main className="content-page">
    <header className="saved-heading"><span className="page-eyebrow">То, что хочется сохранить</span>
      <h1><Heart aria-hidden="true" className="h-7 w-7" />Избранное{hydrated && items.length > 0 ? ` (${items.length})` : ""}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Ваши коды — в одном месте. Избранное хранится в этом браузере.</p>
    </header>
    <FavoritesTransfer />
    {offline&&<p role="status" className="mb-4 text-sm text-muted-foreground">Нет подключения. Сохранённые копии доступны; обновление продолжится после подключения.</p>}
    {!hydrated ? <p role="status">Загружаем избранное…</p> : items.length === 0 ? <div className="empty-state"><div className="empty-icon"><Heart size={27} aria-hidden="true" /></div>
      <p className="font-semibold">Пока нет сохранённых кодов</p>
      <p className="mt-2 text-sm text-muted-foreground">Нажмите сердечко на карточке промокода, чтобы быстро вернуться к нему перед заказом.</p>
      <Link href="/" className="button button-primary mt-5">Найти промокоды</Link>
    </div> : <>
      <div className="filter-bar">
        <label className="search-field"><Search size={17} aria-hidden="true" /><input aria-label="Поиск в избранном" value={query} onChange={event => setQuery(event.target.value)} placeholder="Код или условия" /></label>
        <label className="filter-check"><input type="checkbox" checked={activeOnly} onChange={event => setActiveOnly(event.target.checked)} />Без истёкших</label>
        <button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)} className="secondary-button"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Обновить данные</button>
      </div>
      {loading && <p role="status" className="mb-4 text-sm text-muted-foreground">Обновляем статусы сохранённых кодов…</p>}
      {current?.error && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{current.error} Сохранённые коды остаются в избранном. Их актуальность сейчас проверить нельзя.</p>}
      {current?.loadedAt && <p className="mb-4 text-xs text-muted-foreground">Обновлено: {formatPromoDate(current.loadedAt)} МСК</p>}
      {!loading && filtered.length === 0 && <p className="py-8 text-center text-muted-foreground">Нет сохранённых кодов по выбранным условиям.</p>}
      <div className="results-grid">{filtered.map(item => {
        const offer = resolveSavedOffer(item,current?.codes??[]) ?? item.snapshot;
        return <div key={item.id}>
          <Link href={`/company/${item.companyId}`} className="saved-merchant-link">{getCompanyById(item.companyId)?.name}</Link>
          {offer ? <><p className="saved-offer-note">{resolveSavedOffer(item,current?.codes??[]) ? "Найдено на сайтах. Применение не проверялось." : "Сохранённая копия — без подтверждения актуальности."}</p><PromoCard code={offer} /></> : <article className="promo-card">
            <div className="flex items-start justify-between gap-3"><code className="min-w-0 break-all rounded-lg bg-muted px-3 py-2 font-bold">{item.code}</code><SavePromoButton offer={item} /></div>
            <p className="mt-3 text-sm text-muted-foreground">{loading ? "Загружаем условия и статус…" : current?.error ? "Нет свежих данных об этом предложении." : "Предложение больше не найдено. Проверьте новые акции на странице магазина."}</p>
          </article>}
        </div>;
      })}</div>
    </>}
  </main><SiteFooter /></>;
}
