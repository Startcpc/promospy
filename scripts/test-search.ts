/**
 * Тесты для умного поиска.
 * Запуск: npx tsx scripts/test-search.ts
 */
import { searchCompanies } from "../src/lib/search";

type Case = {
  name: string;
  query: string;
  expectNames?: string[]; // ожидаемые имена (подстроки)
  expectCount?: number; // точное количество (опционально)
  mustInclude?: string[]; // обязательно должны быть в результате
  mustExclude?: string[]; // обязательно НЕ должны быть
};

const cases: Case[] = [
  // === 1. Базовый поиск: «лента» ===
  {
    name: "«лента» — точное имя",
    query: "лента",
    mustInclude: ["Лента"],
  },
  // === 2. Опечатка: «лентввв» → ТОЛЬКО Лента (не ВкусВилл) ===
  {
    name: "«лентввв» — опечатка, только Лента",
    query: "лентввв",
    mustInclude: ["Лента"],
    mustExclude: ["ВкусВилл"],
  },
  // === 3. Опечатка: «озон» vs «озан» / «озн» ===
  {
    name: "«озан» — опечатка в озоне",
    query: "озан",
    mustInclude: ["Ozon"],
  },
  // === 4. «бкозонлавка» — ТЕПЕРЬ ОШИБКА (склейка убрана) ===
  {
    name: "«бкозонлавка» — склейка убрана, ничего не должно найтись",
    query: "бкозонлавка",
    expectCount: 0,
  },
  // === 5. «бкозон» — ТЕПЕРЬ ОШИБКА ===
  {
    name: "«бкозон» — склейка убрана, ничего не должно найтись",
    query: "бкозон",
    expectCount: 0,
  },
  // === 6. «вбвв» — ТЕПЕРЬ ОШИБКА ===
  {
    name: "«вбвв» — склейка убрана, ничего не должно найтись",
    query: "вбвв",
    expectCount: 0,
  },
  // === 6b. «бко» — ОШИБКА (строгое совпадение для коротких алиасов) ===
  {
    name: "«бко» — не точное совпадение, ничего не должно найтись",
    query: "бко",
    expectCount: 0,
  },
  // === 7. Короткий алиас: «бк» ===
  {
    name: "«бк» — Burger King",
    query: "бк",
    mustInclude: ["Burger King"],
  },
  // === 8. Короткий алиас: «вв» ===
  {
    name: "«вв» — ВкусВилл",
    query: "вв",
    mustInclude: ["ВкусВилл"],
  },
  // === 9. Транслит: «bk» ===
  {
    name: "«bk» — Burger King (транслит)",
    query: "bk",
    mustInclude: ["Burger King"],
  },
  // === 10. Транслит: «burger» ===
  {
    name: "«burger» — Burger King (англ)",
    query: "burger",
    mustInclude: ["Burger King"],
  },
  // === 11. Частичное: «бург» → Burger King ===
  {
    name: "«бург» — частичное совпадение",
    query: "бург",
    mustInclude: ["Burger King"],
  },
  // === 12. Пустой запрос → все компании ===
  {
    name: "пустой запрос → все компании",
    query: "",
    expectCount: 12, // всего 12 компаний
  },
  // === 13. Опечатка в «магнит» ===
  {
    name: "«магнит» точно",
    query: "магнит",
    mustInclude: ["Магнит"],
  },
  {
    name: "«магнти» — переставленные буквы",
    query: "магнти",
    mustInclude: ["Магнит"],
  },
  // === 14. Категория: «маркетплейс» ===
  {
    name: "«маркетплейс» — по категории",
    query: "маркетплейс",
    mustInclude: ["Ozon", "Wildberries", "Яндекс Маркет"],
  },
  // === 15. «бквбозон» — ТЕПЕРЬ ОШИБКА (склейка убрана) ===
  {
    name: "«бквбозон» — склейка убрана, ничего не должно найтись",
    query: "бквбозон",
    expectCount: 0,
  },
  // === 16. Мусор между названиями — ничего не должно найтись ===
  {
    name: "«магнитаааоаоаоаоаоавкусно» — мусор",
    query: "магнитаааоаоаоаоаоавкусно",
    expectCount: 0,
  },
  // === 17. Склейка с лишним хвостом — ничего не должно найтись ===
  {
    name: "«бкозонлавкааа» — лишний хвост",
    query: "бкозонлавкааа",
    expectCount: 0,
  },
  // === 18. «лавкабкозон» — ТЕПЕРЬ ОШИБКА (склейка убрана) ===
  {
    name: "«лавкабкозон» — склейка убрана, ничего не должно найтись",
    query: "лавкабкозон",
    expectCount: 0,
  },
  // === 19. «бквввбозон» — ТЕПЕРЬ ОШИБКА ===
  {
    name: "«бквввбозон» — склейка убрана, ничего не должно найтись",
    query: "бквввбозон",
    expectCount: 0,
  },
  // === 20. Случайный мусор — ничего не должен находить ===
  {
    name: "«аааоаоаоа» — чистый мусор",
    query: "аааоаоаоа",
    expectCount: 0,
  },
];

let passed = 0;
let failed = 0;

for (const tc of cases) {
  const result = searchCompanies(tc.query);
  const resultNames = result.map((c) => c.name);

  let ok = true;
  const errors: string[] = [];

  if (tc.expectCount !== undefined && result.length !== tc.expectCount) {
    ok = false;
    errors.push(
      `ожидалось ${tc.expectCount} компаний, получено ${result.length}`,
    );
  }

  if (tc.mustInclude) {
    for (const name of tc.mustInclude) {
      if (!resultNames.some((n) => n.includes(name) || name.includes(n))) {
        ok = false;
        errors.push(`должен содержать «${name}», но не содержит`);
      }
    }
  }

  if (tc.mustExclude) {
    for (const name of tc.mustExclude) {
      if (resultNames.some((n) => n.includes(name) || name.includes(n))) {
        ok = false;
        errors.push(`не должен содержать «${name}», но содержит`);
      }
    }
  }

  if (ok) {
    passed++;
    console.log(
      `✓ ${tc.name}\n   запрос: «${tc.query}» → [${resultNames.join(", ")}]`,
    );
  } else {
    failed++;
    console.log(`✗ ${tc.name}`);
    console.log(`   запрос: «${tc.query}»`);
    console.log(`   результат: [${resultNames.join(", ")}]`);
    for (const e of errors) console.log(`   ⚠ ${e}`);
  }
  console.log("");
}

console.log("─".repeat(60));
console.log(`Итого: ${passed} пройдено, ${failed} провалено`);
process.exit(failed > 0 ? 1 : 0);
