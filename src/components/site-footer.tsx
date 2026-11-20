import Link from "next/link";
import { Radar, ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-inner"><span className="footer-brand"><Radar size={18} aria-hidden="true" /> PromoSpy</span><p>Промокоды магазинов, условия и источники.</p><Link href="/">Каталог магазинов <ArrowUpRight size={14} aria-hidden="true" /></Link></div><p className="footer-note">Публикация промокода не гарантирует применение в корзине.</p></footer>;
}
