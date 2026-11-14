import Link from "next/link";
import { ArrowRight, ArrowUpRight, Bookmark, Check, Globe2, Heart, Leaf, MousePointer2, Search, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroRadar } from "@/components/hero-radar";
import { MotionSurface, ScrollReveal } from "@/components/motion-surface";
import { companies } from "@/lib/companies";

export default function Home() {
  const company = companies[0];
  return <div className="home-page">
    <SiteHeader />
    <main className="home-main" id="top">
      <MotionSurface className="hero-panel">
        <div className="hero-copy">
          <p className="hero-eyebrow"><Leaf size={14} aria-hidden="true" /> Только ВкусВилл <span /> Только то, что нужно</p>
          <h1 className="hero-title" aria-label="Твой вкус. Твоя выгода."><span className="title-line"><span>Твой вкус.</span></span>{' '}<span className="title-line title-line-accent"><span>Твоя выгода.</span></span></h1>
          <p className="hero-description">Промокоды любимого магазина — с условиями, сроками и ссылками на публикации. Всё важное для следующего заказа в одном месте.</p>
          <div className="hero-actions"><Link href="/company/54" className="button button-lime">Промокоды ВкусВилл <ArrowRight className="button-arrow" size={19} aria-hidden="true" /></Link><a href="#how" className="hero-secondary">Как это работает <ArrowUpRight size={16} aria-hidden="true" /></a></div>
          <p className="hero-fineprint"><span><Check size={13} aria-hidden="true" /> Бесплатно</span><span><Check size={13} aria-hidden="true" /> Без регистрации</span></p>
        </div>
        <HeroRadar logo={company.logo} name={company.name} />
      </MotionSurface>
      <div className="trust-strip"><span><Globe2 size={16} aria-hidden="true" /> Открытые источники</span><span><ListIcon /> Условия рядом с кодом</span><span><Bookmark size={16} aria-hidden="true" /> Избранное под рукой</span></div>
      <section className="how-section" id="how" aria-labelledby="how-title">
        <ScrollReveal className="section-heading"><div><span className="eyebrow"><Sparkles size={14} aria-hidden="true" /> Меньше поисков. Больше ясности.</span><h2 id="how-title">От находки до заказа.<br /><span>Три простых шага.</span></h2></div><p>Нажми «Обновить», посмотри условия и сохрани подходящее предложение.</p></ScrollReveal>
        <div className="feature-grid">
          {[{icon:Search,number:'01',title:'Найди своё',text:'Запусти поиск по кнопке «Обновить». Публикации появятся по мере чтения источников.',label:'Свежий поиск',tone:'mint'},{icon:ShieldCheck,number:'02',title:'Посмотри условия',text:'Первый заказ, минимальная сумма, срок действия. У каждой находки есть ссылка на источник.',label:'Внимание к деталям',tone:'lime'},{icon:Heart,number:'03',title:'Оставь под рукой',text:'Сохраняй коды и условия в избранное. Возвращайся к ним, когда соберёшь корзину.',label:'Твои находки',tone:'pink'}].map(({icon:Icon,number,title,text,label,tone},index)=><ScrollReveal key={number} delay={index*75}><MotionSurface className={`feature-card feature-${tone}`}><div className="feature-top"><span className="feature-icon"><Icon size={23} aria-hidden="true" /></span><span className="step-number">{number}</span></div><h3>{title}</h3><p>{text}</p><span className="feature-label"><MousePointer2 size={12} aria-hidden="true" />{label}</span></MotionSurface></ScrollReveal>)}
        </div>
      </section>
      <ScrollReveal><section className="brand-note"><div className="brand-note-icon"><Leaf size={23} aria-hidden="true" /></div><div><h2>Один магазин. Всё внимание — ему.</h2><p>PromoSpy ищет предложения ВкусВилл. Начинаем с официальной страницы и дополняем результат открытыми каталогами.</p></div><a href={company.website} target="_blank" rel="noopener noreferrer" className="text-link">Официальный сайт ВкусВилл <ArrowUpRight size={16} aria-hidden="true" /></a></section></ScrollReveal>
    </main>
    <SiteFooter />
  </div>;
}
function ListIcon(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m3 7 2 2 4-4M12 7h9M3 15l2 2 4-4M12 15h9" /></svg>;}
