import Link from 'next/link';
import { Radar } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
export default function NotFound() {
  return <><SiteHeader back /><main className="content-page"><section className="empty-state mt-12">
    <div className="empty-icon"><Radar size={30} aria-hidden="true" /></div>
    <h1 className="text-3xl font-medium tracking-tight">Страница не найдена</h1>
    <p className="mt-4">Вернёмся к поиску хороших предложений.</p>
    <Link href="/" className="button button-primary mt-6">На главную</Link>
  </section></main></>;
}
