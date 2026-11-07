import { CompanyResults } from "@/components/company-results";
import { notFound } from "next/navigation";
import { getCompanyById } from "@/lib/promocodes";
import { searchState } from "@/lib/search-store";

export const dynamic = "force-dynamic";
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);
  if (!/^\d+$/.test(id) || !getCompanyById(companyId)) notFound();
  const initialState = await searchState(companyId);
  return <CompanyResults key={id} id={companyId} initialState={initialState} />;
}
