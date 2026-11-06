"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Check, Search, ScanLine, Ticket, Sparkles } from "lucide-react";
import { categories, companies } from "@/lib/companies";
import { searchCompanies } from "@/lib/search";
import { CompanyCard } from "@/components/company-card";
import { SavedPromosLink } from "@/components/saved-promos-link";
import { PromoSearch } from "@/components/promo-search";

export default function Home() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const filtered = useMemo(() => searchCompanies(search).filter(company => !category || company.category === category), [search, category]);
  return <div className="min-h-screen bg-[#ffffff] text-[#11254b]">
    <header className="border-b border-[#dce7f9] bg-white/95">
      <nav aria-label="Главная навигация" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" aria-label="PromoSpy — на главную" className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight"><span className="rounded-xl bg-[#ea580c] p-2 text-[#ffffff]"><ScanLine aria-hidden="true" className="h-6 w-6" /></span>Promo<span className="-ml-2.5 text-[#ea580c]">Spy</span><span className="ml-1 rounded-full border border-[#dbeafe] px-2 py-0.5 text-[10px] font-semibold tracking-wider">ПРОМОКОДЫ</span></Link>
        <div className="flex items-center gap-5"><a href="#stores" className="hidden text-sm font-medium hover:underline sm:block">Магазины</a><a href="#offers" className="hidden text-sm font-medium hover:underline sm:block">Предложения</a><SavedPromosLink /></div>
      </nav>
    </header>
    <main className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
      <section className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-xs font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-[#ea580c]" />Меньше поисков. Больше приятных покупок.</p>
          <h1 className="max-w-2xl text-[clamp(2.8rem,6vw,5rem)] font-extrabold leading-[1.04] tracking-[-0.065em]">Хорошие покупки.<br /><span className="text-[#ea580c]">По лучшей цене.</span></h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-[#526581] sm:text-lg">Промокоды любимых магазинов — с условиями, источниками и понятным статусом проверки.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#stores" className="inline-flex items-center gap-4 rounded-xl bg-[#c2410c] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#9a3412]">Найти свой магазин<ArrowDown aria-hidden="true" className="h-4 w-4" /></a><Link href="/saved" className="inline-flex items-center gap-3 rounded-xl border border-[#cddffc] px-5 py-3.5 text-sm font-semibold hover:bg-white">Мои сохранённые<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#526581]"><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" aria-hidden="true" />Без регистрации</span><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" aria-hidden="true" />Условия рядом с кодом</span><span>{companies.length} магазинов в каталоге</span></div>
        </div>
        <div className="relative mx-auto hidden w-full max-w-md pb-5 pr-3 sm:block lg:rotate-1">
          <div className="absolute inset-4 rounded-[36px] bg-[#dbeafe]" />
          <div className="relative rounded-[28px] border border-[#dbeafe] bg-white p-7 shadow-[0_18px_65px_-30px_rgba(29,78,216,0.25)] sm:p-9">
            <div className="mb-7 flex items-center justify-between"><span className="text-[10px] font-bold tracking-[0.2em] text-[#526581]">ВАШ МАРШРУТ К ВЫГОДЕ</span><Ticket className="h-6 w-6 text-[#2563eb]" aria-hidden="true" /></div>
            <p className="text-3xl font-bold leading-tight tracking-tight">Найти. Проверить.<br />Сохранить.</p>
            <div className="my-7 border-t-2 border-dashed border-[#dce7f9]" />
            {[["01", "Выберите магазин", "Доставка, продукты или маркетплейс"], ["02", "Посмотрите условия", "Срок, сумма заказа и источник"], ["03", "Заберите свой код", "Копируйте или сохраните сердечком"]].map(([number,title,detail]) => <div key={number} className="mt-5 flex items-center gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff0e6] text-xs font-bold text-[#2563eb]">{number}</span><div><p className="text-sm font-bold">{title}</p><p className="mt-0.5 text-xs text-[#526581]">{detail}</p></div></div>)}
            <div className="mt-7 flex items-center gap-2 rounded-xl bg-[#eff6ff] px-3 py-3 text-xs text-[#1d4ed8]"><Sparkles aria-hidden="true" className="h-4 w-4 shrink-0" />Публикация и проверка корзины — отдельные статусы</div>
          </div>
        </div>
      </section>
      <section id="stores" className="scroll-mt-6 rounded-[28px] border border-[#dce7f9] bg-white p-5 sm:p-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[10px] font-bold tracking-[0.2em] text-[#c2410c]">ЛЮБИМЫЕ БРЕНДЫ, ЗНАКОМЫЕ МАГАЗИНЫ</p><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Куда заглянем?</h2></div><span className="rounded-full bg-[#eff6ff] px-3 py-1.5 text-xs font-medium">Магазинов: {filtered.length}</span></div>
        <div className="mb-4 flex flex-wrap gap-3"><div className="relative min-w-48 flex-1"><Search aria-hidden="true" className="absolute left-4 top-3.5 h-4 w-4 text-[#6780a4]" /><input aria-label="Поиск магазинов" placeholder="Название магазина: например, «лавка» или «картошка»" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-xl border border-[#dce7f9] bg-white py-3 pl-11 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" /></div><select aria-label="Категория магазинов" value={category} onChange={event => setCategory(event.target.value)} className="min-w-0 max-w-full rounded-xl border border-[#dce7f9] bg-white px-4 py-3 text-sm"><option value="">Все категории</option>{categories.map(item => <option key={item}>{item}</option>)}</select></div>
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Быстрые фильтры магазинов">{[["", "Все магазины"], ["Быстрое питание", "Перекусить"], ["Продукты питания", "За продуктами"], ["Маркетплейс", "На каждый день"]].map(([value,label]) => <button key={label} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${category === value ? "border-[#1d4ed8] bg-[#1d4ed8] text-white" : "border-[#dce7f9] bg-white text-[#526581] hover:border-[#2563eb]"}`}>{label}</button>)}</div>
        {filtered.length ? <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">{filtered.map(company => <CompanyCard key={company.id} company={company} onNavigate={item => router.push(`/company/${item.id}`)} />)}</div> : <div className="py-12 text-center"><Search aria-hidden="true" className="mx-auto mb-3 h-7 w-7 text-[#2563eb]" /><p className="font-semibold">Ничего не найдено</p><p className="mt-2 text-sm text-[#526581]">Попробуйте другое название или категорию.</p><button onClick={() => { setSearch(""); setCategory(""); }} className="mt-4 rounded-lg border px-4 py-2 text-sm">Сбросить фильтры</button></div>}
      </section>
      <div id="offers" className="scroll-mt-6"><PromoSearch /></div>
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[#dce7f9] pt-6 text-xs text-[#526581]"><span className="font-bold text-[#1d4ed8]">PromoSpy · Находите своё выгоднее</span><span>Условия и применимость промокода определяет магазин.</span></footer>
    </main>
  </div>;
}
