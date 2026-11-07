"use client";

import { useEffect, useId, useState, useRef } from "react";
import { Copy, Check, ExternalLink, ChevronDown } from "lucide-react";
import { SavePromoButton } from "./save-promo-button";
import { effectiveStatus, statusLabels, type PromoCode } from "@/lib/promocodes";

export function formatPromoDate(time: number) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow" }).format(time);
}
export function PromoCard({ code }: { code: PromoCode }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const copyAttempt = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    copyAttempt.current++;
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);
  const status = effectiveStatus(code);
  const colors = {
    found: "bg-slate-100 text-slate-700", official: "bg-emerald-100 text-emerald-800", verified: "bg-green-100 text-green-800", rejected: "bg-orange-100 text-orange-800",
    expired: "bg-gray-100 text-gray-600", unavailable: "bg-amber-100 text-amber-800",
  };
  const copy = async () => {
    const attempt = ++copyAttempt.current;
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopied(false); setCopyError(false);
    try {
      await navigator.clipboard.writeText(code.code);
      if (attempt !== copyAttempt.current) return;
      setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      if (attempt === copyAttempt.current) setCopyError(true);
    }
  };
  return <article className="promo-card self-start rounded-lg border-2 border-[#16213e] bg-white p-4 text-[#11254b] shadow-[0_3px_15px_-10px_rgba(29,78,216,0.12)]">
    <div className="flex items-start gap-2">
    <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={detailsId} className="block min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4" aria-label={`Условия ${code.code}`}>
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>{status === "found" && code.evidence?.method === "source" ? "Актуальность не подтверждена" : statusLabels[status]}</span>
      <span className="mt-2 flex items-center gap-2"><span className={`${expanded ? "" : "line-clamp-2"} flex-1 text-sm font-medium`}>{code.description}</span><ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} /></span>
    </button>
    <SavePromoButton offer={code} />
    </div>
    <div className="mt-3 flex items-center gap-2">
      <code className="min-w-0 flex-1 break-all rounded-xl border border-dashed border-[#a9c8ff] bg-[#eff6ff] px-3 py-2 font-bold">{code.code}</code>
      <button onClick={copy} disabled={status === "expired"} aria-label={`Скопировать ${code.code}`} className="rounded-lg bg-[#1d4ed8] p-3 text-white disabled:opacity-40">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
    {copied && <p role="status" className="mt-2 text-xs text-blue-700">Код скопирован</p>}
    {copyError && <p role="alert" className="mt-2 text-xs text-red-600">Не удалось скопировать. Выделите код вручную.</p>}
    {code.sources[0] && <a href={code.sources[0].url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-blue-800 underline">{code.sources[0].name}<ExternalLink aria-hidden="true" className="h-3 w-3" /></a>}
    <div id={detailsId} hidden={!expanded}>
    <p className="mt-3 text-lg font-bold">{code.discount}</p>
    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      {code.minOrder !== undefined && <p>Минимальный заказ: {code.minOrder} ₽</p>}
      {code.startsAt !== undefined && code.startsAt > Date.now() && <p>Акция ещё не началась.</p>}
      {code.startsAt !== undefined && <p>Начало: {formatPromoDate(code.startsAt)} МСК</p>}
      <p>{code.expiresAt !== undefined ? `Срок по источнику: до ${formatPromoDate(code.expiresAt)} МСК` : "Срок действия в источнике не указан"}</p>
      {code.conditions.map((condition, index) => <p key={index}>{condition}</p>)}
      {code.checked !== undefined && <p>{code.evidence?.method === "source" ? "Проверка официального источника" : "Попытка проверки"}: {formatPromoDate(code.checked)} МСК</p>}
      {code.verificationDetails && <p>{code.verificationDetails}</p>}
      {status === "found" && code.checked !== undefined && <p>Актуальность сейчас не подтверждена.</p>}
      {status === "found" && code.evidence?.method === "source" && <p>Код ранее публиковался на официальном сайте. Свежего подтверждения публикации нет; это не означает, что код недействителен.</p>}
      {code.evidence && <p>{[code.evidence.region, code.evidence.accountType, code.evidence.cart].filter(Boolean).join(" · ")}</p>}
      {status === "verified" && <p>Результат относится к указанным условиям тестовой корзины.</p>}
      {status === "official" && <p>Актуален по последней успешной проверке официальной публикации. Статус снимается при подтверждённом исчезновении акции или истечении указанного срока.</p>}
      <div className="flex flex-wrap gap-2 pt-1">{code.sources.slice(1).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
        {source.name}<ExternalLink className="h-3 w-3" />
      </a>)}</div>
    </div>
    </div>
  </article>;
}
