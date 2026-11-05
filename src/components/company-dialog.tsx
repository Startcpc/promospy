"use client";

import { Company } from "@/lib/companies";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand-logo";
import { ExternalLink, MapPin, Calendar, Building2, Package } from "lucide-react";

type Props = {
  company: Company | null;
  onOpenChange: (open: boolean) => void;
};

export function CompanyDialog({ company, onOpenChange }: Props) {
  const open = company !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0 sm:rounded-2xl">
        {company && (
          <>
            {/* Шапка — мягкий нейтральный фон с акцентной полосой */}
            <div className="relative bg-muted/40 px-6 pt-7 pb-5">
              <div
                className="absolute left-0 top-0 h-1 w-full"
                style={{ backgroundColor: `#${company.color}` }}
              />
              <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="h-20 w-20 overflow-hidden rounded-xl border border-border bg-white shadow-sm sm:h-24 sm:w-24">
                  <BrandLogo
                    src={company.logo}
                    name={company.name}
                    accentColor={company.color}
                    size="md"
                    className="h-full w-full rounded-none"
                  />
                </div>
                <div className="text-center sm:text-left">
                  <Badge variant="outline" className="mb-1.5 border-border text-muted-foreground">
                    #{company.id} / 50
                  </Badge>
                  <DialogTitle className="text-xl font-semibold text-foreground sm:text-2xl">
                    {company.name}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                    {company.product} · {company.country}
                  </DialogDescription>
                </div>
              </div>
            </div>

            <DialogHeader className="px-6 pt-5">
              <DialogTitle className="sr-only">{company.name}</DialogTitle>
            </DialogHeader>

            {/* Тело модального окна */}
            <div className="space-y-4 px-6 pb-6">
              <p className="text-sm leading-relaxed text-foreground/80">
                {company.description}
              </p>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Год основания"
                  value={String(company.founded)}
                />
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Штаб-квартира"
                  value={company.hq}
                />
                <InfoRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="Страна"
                  value={company.country}
                />
                <InfoRow
                  icon={<Package className="h-4 w-4" />}
                  label="Продукция"
                  value={company.product}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <Badge variant="secondary" className="rounded-full">
                  {company.category}
                </Badge>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Открыть сайт компании
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-2.5">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
