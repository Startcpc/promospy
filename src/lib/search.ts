/**
 * Строгий поиск по компаниям.
 *
 * ПРАВИЛА:
 *  1. Пустой запрос → все компании.
 *  2. Поиск ТОЛЬКО одной компании за раз. Никаких склеек («бкозонлавка» → ошибка).
 *  3. Короткие алиасы (1-3 буквы: «бк», «вв», «вб») — только ТОЧНОЕ совпадение.
 *     «бк» → Burger King ✓, «бко» → ничего ✗.
 *  4. Длинные токены (4+ букв) — опечатки через Левенштейна.
 *     «лентввв» → Лента, «озан» → Ozon, «магнти» → Магнит.
 *  5. Транслит: «bk» = «бк», «burger» = «бургер».
 *  6. Частичные: «бург» входит в «бургер» → Burger King.
 */

import { companies, type Company } from "@/lib/companies";

/** Транслитерация RU → EN. */
export function translit(s: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
    з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
    ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return s
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("");
}

/** Нормализация: нижний регистр, без пробелов/дефисов/пунктуации. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_'".,!?()]/g, "");
}

/** Расстояние Левенштейна. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Допустимое количество опечаток зависит от длины.
 *  1-3 буквы: 0 опечаток (короткие алиасы — «бк», «вв», «вб» — точное совпадение)
 *  4-6 букв: 2 опечатки (для перестановок типа «магнти» → «магнит»)
 *  7+ букв: 3 опечатки (для серьёзных опечаток типа «лентввв» → «лента»)
 */
function allowedTypos(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 2;
  return 3;
}

/**
 * Строгий fuzzy-match.
 * Для токенов 1-3 буквы — ТОЛЬКО точное совпадение (или транслит-точное).
 * Для токенов 4+ букв — опечатки, частичные совпадения.
 *
 * ВАЖНО: q.includes(t) ограничен 1.25x — чтобы «бкозон» (6) НЕ нашёл «озон» (4),
 * потому что 6 > 4*1.25=5. Это предотвращает ложные срабатывания на склейках.
 */
function fuzzyMatch(query: string, target: string): boolean {
  if (!query || !target) return false;
  const q = normalize(query);
  const t = normalize(target);
  if (!q || !t) return false;
  const qT = translit(query);
  const tT = translit(target);

  // === КОРОТКИЕ ТОКЕНЫ (1-3 буквы) — только точное совпадение ===
  if (t.length <= 3) {
    return q === t || qT === tT;
  }

  // === ДЛИННЫЕ ТОКЕНЫ (4+ букв) ===
  // 1. target включает query (запрос — подстрока: «бург» → «бургер»)
  if (t.includes(q)) return true;
  // 2. query включает target — только если длины сопоставимы (1.25x)
  //    Это предотвращает «бкозон» от матчинга «озон» (6 > 4*1.25=5)
  if (q.length <= t.length * 1.25 && q.includes(t)) return true;
  // 3. query начинается с target — опечатка в конце (разница <= 2)
  if (q.startsWith(t) && q.length - t.length <= 2) return true;
  // 4. target начинается с query — опечатка в конце (разница <= 2)
  if (t.startsWith(q) && t.length - q.length <= 2) return true;
  // 5. Транслит-варианты
  if (tT.includes(qT)) return true;
  if (qT.length <= tT.length * 1.25 && qT.includes(tT)) return true;
  // 6. Левенштейн — настоящие опечатки.
  //    ВАЖНО: первая буква query должна совпадать с первой буквой target.
  //    Иначе «бкозон» (расст. 2 до «озон» через удаление «бк») ложно матчится.
  //    Опечатки не меняют первую букву («магнти»→«магнит», «лентввв»→«лента» — первые совпадают).
  if (q[0] !== t[0]) return false;
  const maxLen = Math.max(q.length, t.length);
  const allowed = allowedTypos(maxLen);
  if (Math.abs(q.length - t.length) > allowed) return false;
  return levenshtein(q, t) <= allowed;
}

/** Все токены компании. */
function companyTokens(c: Company): string[] {
  return [c.name, c.product, c.category, ...c.keywords];
}

/** Соответствует ли компания запросу (строго, одна компания). */
function matchesSingle(query: string, c: Company): boolean {
  return companyTokens(c).some((tok) => fuzzyMatch(query, tok));
}

/**
 * Главная функция поиска. Возвращает массив компаний.
 * Никаких склеек — только одиночный fuzzy-match.
 */
export function searchCompanies(query: string): Company[] {
  if (!query.trim()) return companies;
  return companies.filter((c) => matchesSingle(query, c));
}
