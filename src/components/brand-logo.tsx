"use client";

import { useState } from "react";

type Props = { src: string; name: string; accentColor?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string };
/** Native images paint before hydration; never hide a loaded logo behind JS state. */
export function BrandLogo({ src, name, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  return <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}>
    {failed ? <span className="text-center text-base font-black text-[#16213e]">{name}</span>
      : <img src={src} alt={`Логотип ${name}`} loading="eager" decoding="async" draggable={false}
        onError={() => setFailed(true)} className="h-full w-full object-contain" />}
  </div>;
}
