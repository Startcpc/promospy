import { Search } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreCatalog } from "@/components/store-catalog";
import { CoverPhotos } from "@/components/cover-photos";

export default function Home() {
  return <div className="home-page"><SiteHeader/><main id="main" className="catalog-main">
    <section className="food-cover" aria-labelledby="hero-title">
      <div className="cover-copy"><p className="cover-kicker">Промокоды на продукты и доставку</p>
        <h1 id="hero-title">Что закажем<br/><em>со скидкой?</em></h1>
        <p className="cover-description">Выбери магазин или ресторан. Посмотри опубликованные промокоды, срок и условия перед заказом.</p>
        <a className="cover-action" href="#catalog"><Search size={18} aria-hidden="true"/>Выбрать магазин</a>
      </div><CoverPhotos/>
    </section>
    <StoreCatalog/>
  </main><SiteFooter/></div>;
}
