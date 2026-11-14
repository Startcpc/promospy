"use client";

import { useState } from "react";
import { ArrowUpRight, FileText, Heart, ListChecks, Pause, Play, Radar } from "lucide-react";
import { BrandLogo } from "./brand-logo";

export function HeroRadar({ logo, name }: { logo: string; name: string }) {
  const [paused, setPaused] = useState(false);
  return <div className="hero-visual">
    <div className="motion-scene" data-paused={paused}>
      <div className="radar-glow" aria-hidden="true" />
      <div className="radar-grid" aria-hidden="true" />
      <div className="radar-circle radar-circle-outer" aria-hidden="true" />
      <div className="radar-circle radar-circle-inner" aria-hidden="true" />
      <div className="radar-sweep" aria-hidden="true" />
      <div className="radar-orbit orbit-one" aria-hidden="true"><i /></div>
      <div className="radar-orbit orbit-two" aria-hidden="true"><i /></div>
      <div className="radar-core">
        <span className="core-label"><Radar aria-hidden="true" size={13} /> В центре внимания</span>
        <div className="core-logo"><BrandLogo src={logo} name={name} /></div>
        <span className="core-caption">Твой магазин. Твои условия.</span>
      </div>
      <div className="orbit-card orbit-card-source" aria-hidden="true"><span className="orbit-icon"><FileText size={18} /></span><div><small>Ссылки рядом</small><strong>Открытые источники</strong></div><ArrowUpRight size={16} /></div>
      <div className="orbit-card orbit-card-terms" aria-hidden="true"><span className="orbit-icon"><ListChecks size={18} /></span><div><small>Всё по делу</small><strong>Понятные условия</strong></div></div>
      <div className="orbit-card orbit-card-save" aria-hidden="true"><Heart size={20} /><span>В твоём избранном</span></div>
      <span className="radar-cross cross-one" aria-hidden="true">+</span><span className="radar-cross cross-two" aria-hidden="true">+</span>
    </div>
    <div className="visual-caption"><span><i /> Радар выгодных публикаций</span><button type="button" className="motion-toggle" aria-label={paused ? 'Включить анимацию' : 'Приостановить анимацию'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}</button></div>
  </div>;
}
