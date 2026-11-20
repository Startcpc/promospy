"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import type { Company } from "@/lib/companies";
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
const plural = new Intl.PluralRules("ru");

function StoreStatus({ status, loading }: {status?: CatalogStatus; loading: boolean}) {
  return <div className="catalog-status" data-state={status?.state}>
    <p>{status ? statusLabels[status.state] : loading ? "Загрузка статуса" : statusLabels.unavailable}</p>
    {status?.lastSuccess != null && <p>
      Успешный сбор <time dateTime={new Date(status.lastSuccess).toISOString()}>{scanTime.format(status.lastSuccess)} МСК</time>
    </p>}
  </div>;
}

export function StoreCatalog({ companies }: { companies: Company[] }) {
  const [query, setQuery] = useState("");
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
  const visible = companies.filter(company => company.name.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")));
  const count = plural.select(companies.length);
  return <section className="catalog-section" aria-labelledby="catalog-title">
    <div className="catalog-heading"><div><p className="catalog-kicker">КАТАЛОГ</p><h2 id="catalog-title">Магазины</h2></div><span>{companies.length} {count === "one" ? "магазин" : count === "few" ? "магазина" : "магазинов"}</span></div>
    <label className="catalog-search"><Search size={21} aria-hidden="true" /><span className="sr-only">Поиск магазинов</span><input aria-label="Поиск магазинов" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти магазин" /></label>
    {visible.length ? <div className="catalog-grid">{visible.map(company => <Link key={company.id} href={`/company/${company.id}`} className="catalog-card" style={{"--store-color": `#${company.color}`} as CSSProperties}>
      <div className="catalog-logo" style={{backgroundColor: `#${company.bgColor}`}}><BrandLogo src={company.logo} name={company.name} /></div>
      <StoreStatus status={statuses?.[company.id]} loading={statuses === null} />
      <div className="catalog-card-copy"><h3>{company.name}</h3><span>Смотреть промокоды <ArrowUpRight size={16} aria-hidden="true" /></span></div>
    </Link>)}</div> : <p className="catalog-empty">Такого магазина пока нет в каталоге.</p>}
  </section>;
}
