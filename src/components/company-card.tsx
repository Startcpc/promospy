"use client";

import { ArrowUpRight } from "lucide-react";
import type { Company } from "@/lib/companies";
import { BrandLogo } from "@/components/brand-logo";

export function CompanyCard({ company, onNavigate }: { company: Company; onNavigate: (company: Company) => void }) {
  return <button type="button" onClick={() => onNavigate(company)} aria-label={`Открыть логотип компании ${company.name}`}
    className="group flex min-w-0 flex-row items-center gap-3 rounded-2xl min-[400px]:flex-col min-[400px]:items-stretch min-[400px]:gap-0 border border-[#e0e6da] bg-white p-3 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[#b3c6a4] hover:shadow-[0_10px_28px_-16px_rgba(30,65,40,0.3)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#54815c] sm:p-4">
    <div className="flex h-20 w-20 shrink-0 items-center min-[400px]:h-24 min-[400px]:w-full justify-center overflow-hidden rounded-xl p-4 sm:h-28" style={{ backgroundColor: `#${company.bgColor}` }}><BrandLogo src={company.logo} name={company.name} accentColor={company.color} className="max-w-28" /></div>
    <div className="min-w-0 flex-1 min-[400px]:mt-4">
    <div className="flex w-full items-center justify-between gap-1"><h3 className="min-w-0 break-words text-sm font-bold leading-snug text-[#243d30]">{company.name}</h3><ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#a1ad98] transition-colors group-hover:text-[#214d3c]" /></div>
    <p className="mt-1 text-[10px] text-[#899482]">{company.category}</p>
    </div>
  </button>;
}
