"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Company } from "@/lib/companies";
import { BrandLogo } from "@/components/brand-logo";

export function CompanyCard({ company }: { company: Company }) {
  return <Link prefetch={true} href={`/company/${company.id}`} aria-label={`Промокоды ${company.name}`}
    className="merchant-card group flex min-w-0 flex-row items-center gap-3 rounded-lg min-[400px]:flex-col min-[400px]:items-stretch min-[400px]:gap-0 border-2 border-[#16213e] bg-white p-3 text-left transition-colors hover:border-[#93b9ff] hover:shadow-[0_10px_28px_-16px_rgba(29,78,216,0.3)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563eb] sm:p-4">
    <div className="flex h-20 w-20 shrink-0 items-center min-[400px]:h-24 min-[400px]:w-full justify-center overflow-hidden rounded-xl p-4 sm:h-28" style={{ backgroundColor: `#${company.bgColor}` }}><BrandLogo src={company.logo} name={company.name} accentColor={company.color} className="max-w-28" /></div>
    <div className="min-w-0 flex-1 min-[400px]:mt-4">
    <div className="flex w-full items-center justify-between gap-1"><h3 className="min-w-0 break-words text-base font-bold leading-snug text-[#11254b]">{company.name}</h3><ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6780a4] transition-colors group-hover:text-[#1d4ed8]" /></div>
    </div>
  </Link>;
}
