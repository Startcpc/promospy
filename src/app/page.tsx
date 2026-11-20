import { Bookmark, Globe2, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreCatalog } from "@/components/store-catalog";
import { companies } from "@/lib/companies";

export default function Home() {
  return <div className="home-page">
    <SiteHeader />
    <main className="home-main catalog-home" id="main">
      <section className="catalog-hero" aria-labelledby="hero-title">
        <p className="catalog-kicker">ПРОМОКОДЫ МАГАЗИНОВ В ОДНОМ МЕСТЕ</p>
        <h1 id="hero-title" className="catalog-title">Promo<span>Spy</span></h1>
        <p className="catalog-intro">Выберите магазин и смотрите опубликованные промокоды с условиями и ссылками на источники. Поиск запускается на странице магазина кнопкой «Обновить».</p>
      </section>
      <StoreCatalog companies={companies} />
      <section className="catalog-how" id="how" aria-labelledby="how-title">
        <h2 id="how-title">Как это работает</h2>
        <div className="catalog-how-grid">
          <p><Globe2 size={22} aria-hidden="true" /><strong>Выберите магазин</strong><span>У каждого магазина своя страница и свои источники.</span></p>
          <p><ShieldCheck size={22} aria-hidden="true" /><strong>Проверьте условия</strong><span>Официальные публикации отмечены отдельно; источник открыт по ссылке.</span></p>
          <p><Bookmark size={22} aria-hidden="true" /><strong>Сохраните код</strong><span>Избранное остаётся в вашем браузере и доступно без сети.</span></p>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
