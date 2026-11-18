"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { companies } from "@/lib/companies";
import { merchantAliases, normalizeMerchantName } from "@/lib/merchant-aliases";

const categories = ["Все", "Продукты", "Рестораны", "Доставка"];

export function StoreCatalog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Все");
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
      <span className="shop-text"><strong>{company.name}</strong><small>{company.description}</small></span>
    </Link>)}</div>
    <span className="sr-only" role="status">Магазинов найдено {visible.length}</span>
    {!visible.length && <div className="catalog-empty"><h3>Магазины не найдены</h3><button type="button" onClick={()=>{setQuery("");setCategory("Все");}}><X size={15}/> Сбросить фильтры</button></div>}
  </section>;
}
