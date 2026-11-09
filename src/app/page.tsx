import Link from "next/link";
import { ArrowRight, ArrowUpRight, ScanLine, ShieldCheck, Heart, Search } from "lucide-react";
import { SavedPromosLink } from "@/components/saved-promos-link";
import { AnimatedWord } from "@/components/animated-word";
import { BrandLogo } from "@/components/brand-logo";
import { companies } from "@/lib/companies";

export default function Home() {
  const company = companies[0];
  return <div className="retro-page min-h-screen bg-white text-[#16213e]">
    <header className="border-b-2 border-[#16213e]">
      <nav aria-label="Главная навигация" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" aria-label="PromoSpy — на главную" className="flex items-center gap-2 text-2xl font-black tracking-tight"><span className="retro-brand border-2 border-[#16213e] bg-[#ff6b24] p-2"><ScanLine aria-hidden="true" className="h-6 w-6" /></span>Promo<span className="-ml-2 text-[#e5550b]">Spy</span></Link>
        <SavedPromosLink />
      </nav>
    </header>
    <main className="mx-auto max-w-7xl px-5 pb-10 sm:px-8">
      <section className="retro-hero relative grid items-center gap-8 border-b-2 border-[#16213e] py-10 sm:py-14 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative z-10 min-w-0">
          <p className="mb-5 inline-block border-2 border-[#16213e] bg-[#dbf6e5] px-3 py-1 font-bold">ВкусВилл · продукты с выгодой</p>
          <h1 aria-label="Лови выгоду во ВкусВилл" className="retro-title font-black uppercase"><AnimatedWord text="ЛОВИ" /><br /><span className="text-[#2458e8]"><AnimatedWord text="ВЫГОДУ." /></span></h1>
          <p className="mt-5 max-w-lg text-lg sm:text-xl">Промокоды ВкусВилл с условиями, сроками и ссылками на публикации. Начинаем с официального сайта.</p>
          <Link href="/company/54" className="retro-button mt-7 inline-flex items-center gap-4 border-2 border-[#16213e] bg-[#ff6b24] px-5 py-3 text-lg font-black">Промокоды ВкусВилл<ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0" /></Link>
          <p className="mt-4 text-sm text-muted-foreground">Бесплатно. Без регистрации.</p>
        </div>
        <div className="retro-poster relative mx-auto hidden aspect-square w-full max-w-sm items-center justify-center sm:flex" aria-hidden="true">
          <span className="retro-star" /><span className="retro-stamp border-2 border-[#16213e] bg-white px-5 py-4 text-center text-4xl font-black leading-tight">НАШЁЛ?<br /><span className="text-[#2458e8]">ЗАБИРАЙ.</span><ArrowUpRight className="mx-auto mt-3 h-9 w-9" /></span>
        </div>
      </section>
      <section className="grid gap-8 py-9 lg:grid-cols-[1fr_1.2fr]" aria-labelledby="offers-title">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden border-2 border-[#16213e] bg-[#2dbd65] p-2"><BrandLogo src={company.logo} name={company.name} /></div>
          <div className="min-w-0"><h2 id="offers-title" className="text-2xl font-black sm:text-3xl">Твои предложения<span className="text-[#e5550b]">.</span></h2><p className="mt-3 text-muted-foreground">Первый или повторный заказ? Найди подходящие условия на странице промокодов.</p><a href={company.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-semibold underline">Официальный сайт ВкусВилл ↗</a></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[{icon:Search,title:"Найди",text:"Поиск по коду, скидке и условиям заказа."},{icon:ShieldCheck,title:"Проверь условия",text:"Публикация на сайте не гарантирует применение в корзине."},{icon:Heart,title:"Сохрани",text:"Коды и условия останутся в избранном после перезагрузки."}].map(({icon:Icon,title,text})=><div key={title} className="border-2 border-[#16213e] p-4"><Icon aria-hidden="true" className="mb-3 h-6 w-6 text-[#2458e8]" /><h3 className="font-black">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>)}
        </div>
      </section>
      <footer className="mt-6 border-t-2 border-[#16213e] pt-5 font-black">PromoSpy <span className="text-[#e5550b]">★</span> Лови свой момент.</footer>
    </main>
  </div>;
}
