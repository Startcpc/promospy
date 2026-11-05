"use client";

import { useId, useState } from "react";
import { Copy, Check, ExternalLink, ChevronDown } from "lucide-react";
import { effectiveStatus, statusLabels, type PromoCode } from "@/lib/promocodes";

export function formatPromoDate(time: number) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow" }).format(time);
}
export function PromoCard({ code }: { code: PromoCode }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const status = effectiveStatus(code);
  const colors = {
    found: "bg-slate-100 text-slate-700", official: "bg-emerald-100 text-emerald-800", verified: "bg-green-100 text-green-800", rejected: "bg-orange-100 text-orange-800",
    expired: "bg-gray-100 text-gray-600", unavailable: "bg-amber-100 text-amber-800",
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(code.code); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  };
  return <article className="self-start rounded-xl border border-border bg-card p-3">
    <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={detailsId} className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4" aria-label={`Условия ${code.code}`}>
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>{status === "found" && code.evidence?.method === "source" ? "Актуальность не подтверждена" : statusLabels[status]}</span>
      <span className="mt-2 flex items-center gap-2"><span className={`${expanded ? "" : "line-clamp-2"} flex-1 text-sm font-medium`}>{code.description}</span><ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} /></span>
    </button>
    <div className="mt-3 flex items-center gap-2">
      <code className="min-w-0 flex-1 break-all rounded-lg border border-dashed bg-muted/50 px-3 py-2 font-bold">{code.code}</code>
      <button onClick={copy} disabled={status === "expired"} aria-label={`Скопировать ${code.code}`} className="rounded-lg bg-foreground p-3 text-background disabled:opacity-40">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
    {copyError && <p role="alert" className="mt-2 text-xs text-red-600">Не удалось скопировать. Выделите код вручную.</p>}
    <div id={detailsId} hidden={!expanded}>
    <p className="mt-3 text-lg font-bold">{code.discount}</p>
    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      {code.minOrder !== undefined && <p>Минимальный заказ: {code.minOrder} ₽</p>}
      {code.startsAt !== undefined && code.startsAt > Date.now() && <p>Акция ещё не началась.</p>}
      {code.startsAt && <p>Начало: {formatPromoDate(code.startsAt)} МСК</p>}
      <p>{code.expiresAt ? `Срок по источнику: до ${formatPromoDate(code.expiresAt)} МСК` : "Срок действия в источнике не указан"}</p>
      {code.conditions.map((condition, index) => <p key={index}>{condition}</p>)}
      {code.checked && <p>{code.evidence?.method === "source" ? "Проверка официального источника" : "Попытка проверки"}: {formatPromoDate(code.checked)} МСК</p>}
      {code.verificationDetails && <p>{code.verificationDetails}</p>}
      {status === "found" && code.checked && <p>Актуальность сейчас не подтверждена.</p>}
      {status === "found" && code.evidence?.method === "source" && <p>Код ранее публиковался на официальном сайте. Свежего подтверждения публикации нет; это не означает, что код недействителен.</p>}
      {code.evidence && <p>{[code.evidence.region, code.evidence.accountType, code.evidence.cart].filter(Boolean).join(" · ")}</p>}
      {status === "verified" && <p>Результат относится к указанным условиям тестовой корзины.</p>}
      {status === "official" && <p>Актуален по последней успешной проверке официальной публикации. Статус снимается при подтверждённом исчезновении акции или истечении указанного срока.</p>}
      <div className="flex flex-wrap gap-2 pt-1">{code.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
        {source.name}<ExternalLink className="h-3 w-3" />
      </a>)}</div>
    </div>
    </div>
  </article>;
}
