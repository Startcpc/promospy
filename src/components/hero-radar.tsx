"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

export function CoverPhotos() {
  const [paused, setPaused] = useState(false);
  return <div className="cover-photos" data-paused={paused}>
    <img className="cover-burger" src="/images/catalog-burger.webp" fetchPriority="high" alt="" width="1100" height="870"/>
    <div className="citrus-frame"><img className="cover-citrus" src="/images/catalog-produce.webp" alt="" width="560" height="560"/></div>
    <button type="button" className="motion-toggle" aria-label={paused?"Включить анимацию":"Приостановить анимацию"} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>
  </div>;
}
