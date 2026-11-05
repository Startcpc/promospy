"use client";

import { useState } from "react";

type Props = {
  /** Путь к картинке логотипа в /public, например "/logos/coca-cola.png" */
  src: string;
  /** Название компании (для fallback и alt) */
  name: string;
  /** Акцентный цвет (HEX без #) для фона fallback */
  accentColor?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeMap = {
  sm: "p-2",
  md: "p-3",
  lg: "p-4",
  xl: "p-5",
};

/**
 * Показывает настоящий логотип компании из /public/logos/.
 * Если картинка не загрузилась — показывает стилизованный
 * fallback с инициалами компании на фирменном цвете.
 */
export function BrandLogo({
  src,
  name,
  accentColor = "1F1F1F",
  size = "md",
  className = "",
}: Props) {
  const [error, setError] = useState(false);

  return (
    <div
      className={`flex h-full w-full items-center justify-center overflow-hidden ${className}`}
    >
      {!error ? (
        <img
          src={src}
          alt={`Логотип ${name}`}
          className="h-full w-full object-contain"
          onError={() => setError(true)}
          loading="eager"
          draggable={false}
          // image-rendering: auto — браузер сам выберет лучшее сглаживание.
          // Для PNG-логотипов это даёт чёткие края без «мыла».
          style={{ imageRendering: "auto" }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ backgroundColor: `#${accentColor}` }}
        >
          <span className="text-3xl font-black uppercase text-white sm:text-4xl">
            {name.charAt(0)}
          </span>
        </div>
      )}
    </div>
  );
}
