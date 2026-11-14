import { Radar, ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-inner"><span className="footer-brand"><Radar size={18} aria-hidden="true" /> PromoSpy</span><p>Публикации, условия и твои сохранённые находки.</p><a href="https://vkusvill.ru" target="_blank" rel="noopener noreferrer">Сайт ВкусВилл <ArrowUpRight size={14} aria-hidden="true" /></a></div><p className="footer-note">Публикация промокода не гарантирует применение в корзине.</p></footer>;
}
