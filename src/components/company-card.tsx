"use client";

import { useRef, useState, type MouseEvent } from "react";
import { Company } from "@/lib/companies";
import { BrandLogo } from "@/components/brand-logo";

type Props = {
  company: Company;
  onNavigate: (company: Company) => void;
};

type Ripple = { x: number; y: number; id: number };

/**
 * Карточка компании с простым hover-эффектом подъёма и ripple при клике.
 * Без 3D-трансформаций и preserve-3d — быстро работает на любом устройстве.
 */
export function CompanyCard({ company, onNavigate }: Props) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const rippleId = useRef(0);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    const el = cardRef.current;
    const rect = el
      ? el.getBoundingClientRect()
      : e.currentTarget.getBoundingClientRect();
    const id = ++rippleId.current;
    setRipples((prev) => [
      ...prev,
      { x: e.clientX - rect.left, y: e.clientY - rect.top, id },
    ]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 700);
    onNavigate(company);
  };

  const bgColor = `#${company.bgColor}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        ref={cardRef}
        onClick={handleClick}
        className="group relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl shadow-sm transition-transform duration-200 ease-out hover:-translate-y-1 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 active:translate-y-0 active:scale-[0.97]"
        style={{
          backgroundColor: bgColor,
        }}
        aria-label={`Открыть логотип компании ${company.name}`}
      >
        {/* Логотип */}
        <div className="flex h-full w-full items-center justify-center p-4">
          <BrandLogo
            src={company.logo}
            name={company.name}
            accentColor={company.color}
            size="md"
            className="h-full w-full rounded-none"
          />
        </div>

        {/* Ripple-эффект от точки клика */}
        {ripples.map((r) => (
          <span
            key={r.id}
            className="pointer-events-none absolute rounded-full bg-white/50 animate-ripple"
            style={{
              left: r.x,
              top: r.y,
              width: 10,
              height: 10,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}

        {/* Лёгкая подсветка сверху при hover — как блика */}
        <span
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 40%)",
          }}
        />
      </button>

      {/* Название под карточкой */}
      <div className="flex w-full items-center justify-center px-1 text-center">
        <h3 className="truncate text-[13px] font-semibold leading-tight text-foreground">
          {company.name}
        </h3>
      </div>
    </div>
  );
}
