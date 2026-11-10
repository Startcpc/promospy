import { CompanyResults } from "@/components/company-results";
import { notFound } from "next/navigation";
import { getCompanyById } from "@/lib/promocodes";

export const dynamic = "force-dynamic";
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);
  if (!/^\d+$/.test(id) || !getCompanyById(companyId)) notFound();
  return <CompanyResults key={id} id={companyId} />;
}
