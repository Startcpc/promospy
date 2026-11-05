"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import type { PromoCode } from "@/lib/promocodes";
import { setPromoSaved, useSavedPromos } from "@/hooks/use-saved-promos";

export function SavePromoButton({ offer }: { offer: Pick<PromoCode, "id" | "code" | "companyId"> }) {
  const { items, hydrated } = useSavedPromos();
  const [error, setError] = useState<string | null>(null);
  const saved = items.some(item => item.id === offer.id);
  return <div className="shrink-0">
    <button type="button" disabled={!hydrated} aria-pressed={saved}
      aria-label={`${saved ? "Удалить из избранного" : "Сохранить"} ${offer.code}`}
      title={saved ? "Удалить из избранного" : "Сохранить в избранное"}
      onClick={() => setError(setPromoSaved(offer, !saved))}
      className={`rounded-lg border p-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 ${saved ? "border-rose-200 bg-rose-50 text-rose-700" : "text-muted-foreground hover:bg-muted"}`}>
      <Heart aria-hidden="true" className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
    </button>
    {error && <p role="alert" className="mt-2 max-w-48 text-xs text-red-600">{error}</p>}
  </div>;
}
