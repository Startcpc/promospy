"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import type { PromoCode } from "@/lib/promocodes";
import { setPromoSaved, useSavedPromos } from "@/hooks/use-saved-promos";
import { savedOfferMatches } from "@/lib/saved-promos";

export function SavePromoButton({ offer }: { offer: Pick<PromoCode, "id" | "code" | "companyId">&Partial<PromoCode> }) {
  const { items, hydrated } = useSavedPromos();
  const [error, setError] = useState<string | null>(null);
  const saved = items.some(item => savedOfferMatches(item,offer));
  return <div className="shrink-0">
    <button type="button" disabled={!hydrated} aria-pressed={saved}
      aria-label={`${saved ? "Удалить из избранного" : "Сохранить"} ${offer.code}`}
      title={saved ? "Удалить из избранного" : "Сохранить в избранное"}
      onClick={() => setError(setPromoSaved(offer, !saved))}
      className="save-control" data-saved={saved}>
      <Heart aria-hidden="true" className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
    </button>
    {error && <p role="alert" className="mt-2 max-w-48 text-xs text-red-600">{error}</p>}
  </div>;
}
