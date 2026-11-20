"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { companies } from "@/lib/companies";
import { merchantAliases, normalizeMerchantName } from "@/lib/merchant-aliases";

import type { CatalogStatus } from "@/lib/catalog-status";
import { browserRequestSignal } from "@/lib/browser-request";
import { canRequestFromPage, watchPageActivity } from "@/lib/page-activity";

const statusLabels: Record<CatalogStatus["state"], string> = {
  unchecked: "Ещё не проверяли",
  updating: "Идёт сбор",
  ready: "Промокоды найдены",
  empty: "Актуальных промокодов нет",
  partial: "Обновлено частично",
  failed: "Не удалось обновить",
  saved: "Данные сохранены",
  unavailable: "Статус недоступен",
};
const scanTime = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow",
});


function StoreStatus({ status, loading }: {status?: CatalogStatus; loading: boolean}) {
  return <div className="catalog-status" data-state={status?.state}>
    <p>{status ? statusLabels[status.state] : loading ? "Загрузка статуса" : statusLabels.unavailable}</p>
    {status?.lastSuccess != null && <p>
      Успешный сбор <time dateTime={new Date(status.lastSuccess).toISOString()}>{scanTime.format(status.lastSuccess)} МСК</time>
    </p>}
  </div>;
}


const categories = ["Все", "Продукты", "Рестораны", "Доставка"];

export function StoreCatalog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Все");
  const [statuses, setStatuses] = useState<Record<number, CatalogStatus> | null>(null);
  useEffect(() => {
    let active: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (active || !canRequestFromPage()) return;
      const controller = new AbortController();
      active = controller;
      const request = browserRequestSignal(controller.signal, 10_000);
      try {
        const response = await fetch("/api/catalog-status", {signal: request.signal, cache: "no-store"});
        if (!response.ok) throw new Error("Статус недоступен");
        const {stores} = await response.json() as {stores: Record<number, CatalogStatus>};
        if (!controller.signal.aborted) setStatuses(stores);
      } catch {
        if (!controller.signal.aborted) setStatuses({});
      } finally {
        request.dispose();
        if (active === controller) {
          active = undefined;
          timer = setTimeout(load, 15_000);
        }
      }
    };
    const pause = () => {
      clearTimeout(timer);
      active?.abort();
      active = undefined;
    };
    const stopWatching = watchPageActivity(() => void load(), pause);
    void load();
    return () => { stopWatching(); pause(); };
  }, []);
  const words = query.trim().split(/\s+/).map(normalizeMerchantName).filter(Boolean);
  const visible = companies.filter(company => {
    const terms = [company.name, company.category, company.description, ...merchantAliases[company.id]].map(normalizeMerchantName);
    return (category === "Все" || category === company.category) && words.every(word => terms.some(term => term.includes(word)));
  });
  return <section id="catalog" className="store-catalog" aria-labelledby="catalog-title">
    <div className="catalog-toolbar"><h2 id="catalog-title">Каталог магазинов</h2>
      <label className="catalog-input"><Search size={18} aria-hidden="true"/><input aria-label="Поиск магазинов" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Название или кухня" /></label>
    </div>
    <div className="catalog-tabs" role="group" aria-label="Категории">{categories.map(item=><button type="button" key={item} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</button>)}</div>
    <div className="shop-grid">{visible.map(company=><Link key={company.id} href={`/company/${company.id}`} prefetch={false} className="shop-tile" aria-label={`Промокоды ${company.name}`}>
      <span className="shop-mark" style={{backgroundColor:"#"+company.bgColor,color:"#"+company.color}} aria-hidden="true">{company.logo ? <img src={company.logo} alt="" width="57" height="48"/> : company.mark}</span>
      <div className="shop-text"><strong>{company.name}</strong><small>{company.description}</small><StoreStatus status={statuses?.[company.id]} loading={statuses===null}/></div>
    </Link>)}</div>
    <span className="sr-only" role="status">Магазинов найдено {visible.length}</span>
    {!visible.length && <div className="catalog-empty"><h3>Магазины не найдены</h3><button type="button" onClick={()=>{setQuery("");setCategory("Все");}}><X size={15}/> Сбросить фильтры</button></div>}
  </section>;
}
