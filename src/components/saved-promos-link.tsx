"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useSavedPromos } from "@/hooks/use-saved-promos";

export function SavedPromosLink() {
  const { items } = useSavedPromos();
  return <Link prefetch={false} href="/saved" className="inline-flex items-center gap-2 retro-button rounded-none border-2 border-[#16213e] bg-white px-3 py-2 text-sm font-medium text-[#1d4ed8] hover:bg-[#eff6ff]">
    <Heart aria-hidden="true" className="h-4 w-4" />Избранное{items.length > 0 ? ` (${items.length})` : ""}
  </Link>;
}
