"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useSavedPromos } from "@/hooks/use-saved-promos";

export function SavedPromosLink() {
  const { items } = useSavedPromos();
  return <Link href="/saved" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
    <Heart aria-hidden="true" className="h-4 w-4" />Избранное{items.length > 0 ? ` (${items.length})` : ""}
  </Link>;
}
