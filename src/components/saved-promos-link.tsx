"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useSavedPromos } from "@/hooks/use-saved-promos";

export function SavedPromosLink() {
  const { items } = useSavedPromos();
  return <Link prefetch={true} href="/saved" className="saved-link" aria-label={`Избранное${items.length > 0 ? ` (${items.length})` : ''}`}>
    <Heart aria-hidden="true" size={16} /><span className="nav-save-text">Избранное</span>{items.length > 0 && <span className="nav-count">{items.length}</span>}
  </Link>;
}
