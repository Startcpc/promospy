"use client";

import { useState } from "react";

type Props = { src: string; name: string; accentColor?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string };
/** Keep a readable fallback while an external brand asset loads or is unavailable. */
export function BrandLogo({ src, name, accentColor = "1F1F1F", className = "" }: Props) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  return <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}>
    {state !== "loaded" && <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-3xl font-black text-white" style={{ backgroundColor: `#${accentColor}` }}>{name.charAt(0)}</span>}
    {state !== "error" && <img src={src} alt={`Логотип ${name}`} loading="eager" draggable={false}
      onLoad={() => setState("loaded")} onError={() => setState("error")}
      className={`absolute inset-0 h-full w-full object-contain ${state === "loaded" ? "opacity-100" : "opacity-0"}`} />}
  </div>;
}
