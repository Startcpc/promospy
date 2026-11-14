import Link from "next/link";
import { ArrowLeft, Radar } from "lucide-react";
import { SavedPromosLink } from "./saved-promos-link";

export function SiteHeader({ back = false }: { back?: boolean }) {
  return <header className="site-header"><nav className="site-nav" aria-label={back ? 'Навигация' : 'Главная навигация'}>
    <Link href="/" aria-label="PromoSpy — на главную" className="brand"><span className="brand-mark"><Radar size={23} aria-hidden="true" /></span><span className="brand-word">Promo<span>Spy</span></span></Link>
    <div className="nav-actions">{back ? <Link href="/" className="back-link" aria-label="На главную"><ArrowLeft size={16} aria-hidden="true" /><span>На главную</span></Link> : <a href="#how" className="how-link">Как это работает</a>}<SavedPromosLink /></div>
  </nav></header>;
}
