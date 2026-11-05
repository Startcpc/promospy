"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { companies, Company } from "@/lib/companies";
import { searchCompanies } from "@/lib/search";
import { CompanyCard } from "@/components/company-card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { PromoSearch } from "@/components/promo-search";

export default function Home() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return searchCompanies(search);
  }, [search]);

  // Клик по карточке — переход на страницу промокодов компании
  const handleCardClick = (company: Company) => {
    router.push(`/company/${company.id}`);
  };

  // Заголовок «PromoSpy» — для анимации по буквам
  const titleText = "PromoSpy";
  const titleWords = [titleText]; // одно слово — цельный бренд
  // Сколько «глубинных» слоёв у каждой буквы — это и есть её объём по Z.
  // При вращении родителя (title-float-3d) эти слои становятся видны сбоку —
  // буквы реально выглядят как 3D-объекты в кубическом пространстве.
  const DEPTH_LAYERS = 7;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Шапка: по центру — «PromoSpy» с 3D-анимацией */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1600px] items-center justify-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {/* Центр: 3D-заголовок «PromoSpy» */}
          <h1
            className="flex flex-wrap justify-center text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl"
            style={{
              perspective: "1000px",
              perspectiveOrigin: "50% 45%",
            }}
          >
            {/* Внутренний «куб» — медленно крутится постоянно, чтобы объём был виден */}
            <span
              className="inline-flex flex-wrap items-end"
              style={{
                transformStyle: "preserve-3d",
                animation: "title-float-3d 12s ease-in-out infinite",
              }}
            >
              {titleWords.map((word, wi) => (
                <span
                  key={wi}
                  className="inline-flex overflow-visible pb-2"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {word.split("").map((char, ci) => (
                    <span
                      key={`${wi}-${ci}`}
                      className="relative inline-block"
                      style={{
                        transformStyle: "preserve-3d",
                        // Медленная 3D-анимация: буква прилетает из-за экрана
                        animation: "title-letter-3d 1.8s cubic-bezier(0.22, 1, 0.36, 1) both",
                        animationDelay: `${ci * 110}ms`,
                      }}
                    >
                      {/* Глубинные слои — каждый чуть глубже по Z и темнее.
                          Они создают настоящий 3D-объём буквы. */}
                      {Array.from({ length: DEPTH_LAYERS }, (_, k) => k + 1).map(
                        (z) => (
                          <span
                            key={z}
                            aria-hidden="true"
                            className="inline-block"
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              transform: `translateZ(${-z * 2.2}px)`,
                              color: `rgba(20, 20, 40, ${0.6 - z * 0.06})`,
                            }}
                          >
                            {char}
                          </span>
                        ),
                      )}
                      {/* Лицевой слой — градиент по всему слову PromoSpy */}
                      <span
                        className="inline-block"
                        style={{
                          position: "relative",
                          transform: "translateZ(0)",
                          color: "transparent",
                          backgroundImage:
                            "linear-gradient(90deg, #6366F1, #8B5CF6, #EC4899, #F59E0B, #10B981, #6366F1)",
                          backgroundSize: "200% auto",
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          animation: "gradient-shift 5s ease-in-out 1800ms infinite",
                        }}
                      >
                        {char}
                      </span>
                    </span>
                  ))}
                </span>
              ))}
            </span>
          </h1>
        </div>
      </header>

      {/* Sticky-поиск (без фильтров) */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: «бк», «озон», «лавка»..."
              className="h-10 rounded-lg border-border bg-muted/30 pl-10 pr-4 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Сетка логотипов */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-base font-medium text-foreground">
              Ничего не найдено
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Попробуй другой запрос. Можно искать по названию, типу или
              алиасу (например «вб» для Wildberries).
            </p>
            <button
              onClick={() => setSearch("")}
              className="mt-2 cursor-pointer rounded-full border border-border px-4 py-1.5 text-sm font-medium transition-transform active:scale-95 hover:bg-muted"
            >
              Сбросить
            </button>
          </div>
        ) : (
          <div
            className="grid gap-3 sm:gap-4"
            style={{
              // Чуть крупнее карточки — лучше качество логотипа
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 150px), 1fr))",
            }}
          >
            {filtered.map((c, i) => (
              <div
                key={c.id}
                style={{
                  animation: `card-in 0.5s ease-out ${Math.min(i * 40, 800)}ms both`,
                }}
              >
                <CompanyCard company={c} onNavigate={handleCardClick} />
              </div>
            ))}
          </div>
        )}
        <PromoSearch />
      </main>
    </div>
  );
}

