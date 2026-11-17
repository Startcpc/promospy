"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Pause, Play, Radar } from "lucide-react";
import { BrandLogo } from "./brand-logo";

export function HeroRadar({ logo, name }: { logo: string; name: string }) {
  const [paused, setPaused] = useState(false);
  return <div className="hero-visual">
    <div className="visual-topline"><span><Radar size={17} aria-hidden="true" /> РАДАР ВЫГОДЫ</span><span>ТОЛЬКО ВКУСВИЛЛ</span></div>
    <div className="motion-scene" data-paused={paused}>
      <div className="radar-circle radar-circle-outer" aria-hidden="true" />
      <div className="radar-circle radar-circle-inner" aria-hidden="true" />
      <div className="radar-sweep" aria-hidden="true" />
      <div className="radar-orbit orbit-one" aria-hidden="true"><i /></div>
      <div className="radar-core">
        <div className="ticket-top"><span>Твой магазин</span><ArrowUpRight size={20} aria-hidden="true" /></div>
        <div className="core-logo"><BrandLogo src={logo} name={name} /></div>
        <p className="ticket-title">Всё нужное.<br />С приятной выгодой.</p>
        <div className="ticket-divider" />
        <div className="ticket-checks"><span><Check size={16} aria-hidden="true" /> Промокоды и условия</span><span><Check size={16} aria-hidden="true" /> Ссылки на публикации</span></div>
        <div className="ticket-bottom"><span>НАХОДКИ НА КАЖДЫЙ ДЕНЬ</span><span className="ticket-bars" aria-hidden="true" /></div>
      </div>
      <span className="radar-cross cross-one" aria-hidden="true">✳</span><span className="radar-cross cross-two" aria-hidden="true">+</span>
    </div>
    <div className="visual-caption"><span><i /> Поиск начинается по твоей кнопке</span><button type="button" className="motion-toggle" aria-label={paused ? "Включить анимацию" : "Приостановить анимацию"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}</button></div>
  </div>;
}
