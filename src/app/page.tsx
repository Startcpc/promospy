import Link from "next/link";
import { ArrowRight, ArrowUpRight, Bookmark, Check, Globe2, Leaf, Search, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroRadar } from "@/components/hero-radar";
import { ScrollReveal } from "@/components/scroll-reveal";
import { companies } from "@/lib/companies";
import { PUBLIC_CATALOGUES } from "@/lib/source-catalog";

export default function Home() {
  const company = companies[0];
  return <div className="home-page">
    <SiteHeader />
    <main className="home-main" id="main">
      <section className="hero-panel" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="hero-eyebrow"><span className="eyebrow-dot" /> Маленькая привычка. Приятная экономия.</p>
          <h1 className="hero-title" id="hero-title">Покупки <br />по вкусу.<br /><span>Скидки — кстати.</span></h1>
          <p className="hero-description">Собираем промокоды ВкусВилл из открытых источников. Чтобы ты выбирал продукты, а не перебирал десятки вкладок.</p>
          <div className="hero-actions"><Link href="/company/54" className="button button-primary">Промокоды ВкусВилл <ArrowRight className="button-arrow" size={20} aria-hidden="true" /></Link></div>
          <p className="hero-fineprint"><span><Check size={15} aria-hidden="true" /> Бесплатно</span><span><Check size={15} aria-hidden="true" /> Без регистрации</span></p>
        </div>
        <HeroRadar logo={company.logo} name={company.name} />
      </section>
      <div className="trust-strip"><span><Globe2 size={19} aria-hidden="true" /> Источник у каждого кода</span><span><ShieldCheck size={19} aria-hidden="true" /> Условия без мелкого шрифта</span><span><Bookmark size={19} aria-hidden="true" /> Избранное в твоём браузере</span></div>
      <section className="how-section" id="how" aria-labelledby="how-title">
        <ScrollReveal className="section-heading"><div><span className="eyebrow">КАК ЭТО РАБОТАЕТ</span><h2 id="how-title">Меньше поиска.<br /><span>Больше приятных находок.</span></h2></div><p>От первого клика до следующего заказа — всего три шага.</p></ScrollReveal>
        <div className="feature-grid">
          {[
            { icon: Search, number: "01", title: "Запусти поиск", text: "Открой страницу магазина и нажми «Обновить». Промокоды появятся по мере чтения источников.", tone: "mint" },
            { icon: ShieldCheck, number: "02", title: "Выбери по условиям", text: "Сумма заказа, срок и ограничения — рядом с кодом. Оригинальная публикация всегда в один клик.", tone: "lime" },
            { icon: Bookmark, number: "03", title: "Сохрани на потом", text: "Скопируй код перед заказом или добавь в избранное. Сохранённые условия доступны даже без сети.", tone: "pink" },
          ].map(({ icon: Icon, number, title, text, tone }, index) => <ScrollReveal key={number} delay={index * 70}><div className={`feature-card feature-${tone}`}><div className="feature-top"><Icon size={26} strokeWidth={1.5} aria-hidden="true" /><span className="step-number">{number}</span></div><h3>{title}</h3><p>{text}</p></div></ScrollReveal>)}
        </div>
      </section>
      <section className="source-section" aria-labelledby="source-title"><div><span className="eyebrow">ПРОЗРАЧНЫЙ ПОИСК</span><h2 id="source-title">Знаешь, откуда выгода.</h2><p>Сначала официальный сайт, затем публичные каталоги. Отмечаем, где опубликован код; применение зависит от условий твоего заказа.</p></div><div className="source-list"><a href="https://vkusvill.ru/promocodes/" target="_blank" rel="noopener noreferrer"><Leaf size={17} aria-hidden="true" /><span>ВкусВилл <small>Официальный источник</small></span><ArrowUpRight size={17} aria-hidden="true" /></a>{PUBLIC_CATALOGUES.map(source => <a key={source.domain} href={source.pages[54][0]} target="_blank" rel="noopener noreferrer"><Globe2 size={17} aria-hidden="true" /><span>{source.name}</span><ArrowUpRight size={17} aria-hidden="true" /></a>)}</div></section>
    </main>
    <SiteFooter />
  </div>;
}
