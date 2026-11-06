import { CompanyResults } from "@/components/company-results";
import { searchState } from "@/lib/search-store";

export const dynamic = "force-dynamic";
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);
  const initialState = await searchState(companyId);
  return <CompanyResults key={id} id={companyId} initialState={initialState} />;
}
