"use client";

import { startTransition } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return <><SiteHeader back /><main className="content-page" id="main"><section className="empty-state mt-8">
    <div className="empty-icon"><RefreshCw size={28} aria-hidden="true" /></div>
    <h1 className="text-2xl font-semibold">Не получилось открыть страницу</h1>
    <p className="mt-4">Попробуй ещё раз. Сохранённое в этом браузере избранное останется на месте.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => startTransition(() => retry())} className="button button-primary">Попробовать снова</button><Link href="/" className="secondary-button">На главную</Link></div>
  </section></main></>;
}
