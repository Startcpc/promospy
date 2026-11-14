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
  const observedAt=Math.max(code.found,...code.sources.map(source=>source.seenAt));
  const colors = {
    found: "bg-[#eef2e9] text-[#6b7c5f]", official: "bg-[#e8f3de] text-[#537d3d]", verified: "bg-green-100 text-green-800", rejected: "bg-amber-100 text-amber-800",
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
  return <article className="promo-card">
    <div className="promo-top">
      <span className={`status-pill ${colors[status]}`}>{status === "found" && code.evidence?.method === "source" ? "Актуальность не подтверждена" : statusLabels[status]}</span>
      <SavePromoButton offer={code} />
    </div>
    <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={detailsId} className="promo-title-button" aria-label={`Условия ${code.code}`}>
      <span className="promo-discount">{code.discount}</span>
      <span className="promo-description"><span className={expanded ? "" : "line-clamp-2"}>{code.description}</span><ChevronDown aria-hidden="true" size={16} data-expanded={expanded} /></span>
    </button>
    <div className="promo-code-row">
      <div className="promo-code-field"><span>ПРОМОКОД</span><code>{code.code}</code></div>
      <button onClick={copy} disabled={status === "expired"} aria-label={`Скопировать ${code.code}`} className="copy-control" data-copied={copied}>
        {copied ? <Check aria-hidden="true" size={19} /> : <Copy aria-hidden="true" size={18} />}
      </button>
    </div>
    {code.cached && <p className="mt-2 text-xs text-amber-800">Сохранено ранее · источник не обновлён</p>}
    {copied && <p role="status" className="mt-2 text-xs text-green-800">Код скопирован</p>}
    {copyError && <p role="alert" className="mt-2 text-xs text-red-600">Не удалось скопировать. Выделите код вручную.</p>}
    {code.sources[0] && <a href={code.sources[0].url} target="_blank" rel="noopener noreferrer" className="promo-source">{code.sources[0].name}<ExternalLink aria-hidden="true" className="h-3 w-3" /></a>}
    <div id={detailsId} hidden={!expanded} className="promo-details">
    <div>
      <p>Последнее чтение источников: {formatPromoDate(observedAt)} МСК</p>
      {code.confidence && <p>Надёжность извлечения: {code.confidence.level === "high" ? "высокая" : code.confidence.level === "medium" ? "средняя" : "ограниченная"}. Это не проверка применения.</p>}
      {code.appOnly && <p>Только в приложении</p>}
      {code.maxDiscount !== undefined && <p>Максимальная скидка: {code.maxDiscount} ₽</p>}
      {code.regions?.length ? <p>Регионы по источнику: {code.regions.join(", ")}</p> : null}
      {code.categories?.length ? <p>Категории по источнику: {code.categories.join(", ")}</p> : null}
      {code.minOrder !== undefined && <p>Минимальный заказ: {code.minOrder} ₽</p>}
      {code.startsAt !== undefined && code.startsAt > Date.now() && <p>Акция ещё не началась.</p>}
      {code.startsAt !== undefined && <p>Начало: {formatPromoDate(code.startsAt)} МСК</p>}
      <p>{code.expiresAt !== undefined ? `Срок по источнику: до ${formatPromoDate(code.expiresAt)} МСК` : "Точная дата окончания в источнике не указана"}</p>
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
