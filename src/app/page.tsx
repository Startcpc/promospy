"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Search, ScanLine } from "lucide-react";
import { categories } from "@/lib/companies";
import { searchCompanies } from "@/lib/search";
import { CompanyCard } from "@/components/company-card";
import { SavedPromosLink } from "@/components/saved-promos-link";
import { PromoSearch } from "@/components/promo-search";
import { AnimatedWord } from "@/components/animated-word";

export default function Home() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const filtered = useMemo(() => searchCompanies(search).filter(company => !category || company.category === category), [search, category]);
  return <div className="retro-page min-h-screen bg-white text-[#16213e]">
    <header className="border-b-2 border-[#16213e] bg-white">
      <nav aria-label="Главная навигация" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" aria-label="PromoSpy — на главную" className="flex items-center gap-2 text-2xl font-black tracking-tight"><span className="retro-brand border-2 border-[#16213e] bg-[#ff6b24] p-2"><ScanLine aria-hidden="true" className="h-6 w-6" /></span>Promo<span className="-ml-2 text-[#e5550b]">Spy</span></Link>
        <div className="flex items-center gap-5"><a href="#stores" className="hidden text-base font-bold underline-offset-4 hover:underline sm:block">Магазины</a><SavedPromosLink /></div>
      </nav>
    </header>
    <main className="mx-auto max-w-7xl px-5 pb-10 sm:px-8">
      <section className="retro-hero relative grid items-center gap-8 border-b-2 border-[#16213e] py-10 sm:py-14 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative z-10">
          <h1 aria-label="Лови выгоду" className="retro-title font-black uppercase"><AnimatedWord text="ЛОВИ" /><br /><span className="text-[#2458e8]"><AnimatedWord text="ВЫГОДУ." /></span></h1>
          <p className="mt-5 max-w-md text-lg sm:text-xl">Любимые магазины. Нужные промокоды.</p>
          <a href="#stores" className="retro-button mt-7 inline-flex items-center gap-8 border-2 border-[#16213e] bg-[#ff6b24] px-6 py-3 text-lg font-black">За промокодами<ArrowDown aria-hidden="true" className="h-5 w-5" /></a>
        </div>
        <a href="#offers" aria-label="Найти предложения" className="retro-poster relative mx-auto hidden aspect-square w-full max-w-sm items-center justify-center sm:flex">
          <span aria-hidden="true" className="retro-star" />
          <span aria-hidden="true" className="retro-stamp border-2 border-[#16213e] bg-white px-5 py-4 text-center text-4xl font-black leading-tight">НАШЁЛ?<br /><span className="text-[#2458e8]">ЗАБИРАЙ.</span><ArrowUpRight className="mx-auto mt-3 h-9 w-9" /></span>
        </a>
      </section>
      <section id="stores" className="scroll-mt-6 py-9">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><h2 className="text-3xl font-black tracking-tight sm:text-4xl">Твои магазины<span className="text-[#e5550b]">.</span></h2><span className="font-mono text-base">Найдено: {filtered.length}</span></div>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-48 flex-1"><Search aria-hidden="true" className="absolute left-4 top-4 h-5 w-5" /><input aria-label="Поиск магазинов" placeholder="Какой магазин ищем?" value={search} onChange={event => setSearch(event.target.value)} className="w-full border-2 border-[#16213e] bg-white py-3 pl-12 pr-4 text-base" /></div>
          <select aria-label="Категория магазинов" value={category} onChange={event => setCategory(event.target.value)} className="max-w-full border-2 border-[#16213e] bg-white px-4 py-3 text-base"><option value="">Все категории</option>{categories.map(item => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Быстрые фильтры магазинов">{[["", "Все магазины"], ["Быстрое питание", "Перекусить"], ["Продукты питания", "За продуктами"], ["Маркетплейс", "На каждый день"]].map(([value,label]) => <button key={label} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={`retro-filter border-2 border-[#16213e] px-3 py-2 text-sm font-bold ${category === value ? "bg-[#2458e8] text-white" : "bg-white hover:bg-[#fff0de]"}`}>{label}</button>)}</div>
        {filtered.length ? <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">{filtered.map(company => <CompanyCard key={company.id} company={company} onNavigate={item => router.push(`/company/${item.id}`)} />)}</div> : <div className="border-2 border-dashed border-[#16213e] p-8 text-center"><p className="text-xl font-bold">Ничего не найдено</p><button onClick={() => { setSearch(""); setCategory(""); }} className="retro-button mt-4 border-2 border-[#16213e] bg-[#ff6b24] px-4 py-2 font-bold">Сбросить фильтры</button></div>}
      </section>
      <div id="offers" className="scroll-mt-6 border-t-2 border-[#16213e]"><PromoSearch /></div>
      <footer className="mt-12 border-t-2 border-[#16213e] pt-5 text-base font-black">PromoSpy <span className="text-[#e5550b]">★</span> Лови свой момент.</footer>
    </main>
  </div>;
}
