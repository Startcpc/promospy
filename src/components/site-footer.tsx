import Link from "next/link";
import { Radar } from "lucide-react";

export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-inner"><span className="footer-brand"><Radar size={19} aria-hidden="true"/> PromoSpy</span><p>Условия применения промокода проверяет магазин при заказе.</p><Link href="/#catalog">Каталог магазинов</Link></div></footer>;
}
