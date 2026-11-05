import { parsePromoDate } from "./promo-parser";

const months = "января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря";
const fullDate = `(?:\\d{1,2}\\.\\d{1,2}\\.\\d{4}|\\d{1,2}\\s+(?:${months})\\s+\\d{4})`;

/** Dates must be explicit. A year shared by both ends of a range is source data, not a guess. */
export function extractOfficialDates(terms: string): { startsAt?: number; expiresAt?: number } {
  let normalized = terms.replace(/\u00a0|\u202f/g, " ");
  normalized = normalized.replace(/с\s+(\d{1,2}\.\d{1,2})\s+(?:по|до|[–—-])\s+(\d{1,2}\.\d{1,2})\.(\d{4})/gi,
    (_, start, end, year) => `с ${start}.${year} по ${end}.${year}`);
  normalized = normalized.replace(new RegExp(`с\\s+(\\d{1,2})(?:\\s+(${months}))?\\s+(?:по|до|[–—-])\\s+(\\d{1,2})\\s+(${months})\\s+(\\d{4})`, "gi"),
    (_, start, firstMonth, end, lastMonth, year) => `с ${start} ${firstMonth ?? lastMonth} ${year} по ${end} ${lastMonth} ${year}`);
  const read = (prefix: string, endOfDay: boolean) => {
    const values = [...normalized.matchAll(new RegExp(`(?:^|[\\s(,;:])(?:${prefix})\\s+(${fullDate})(?!\\d)`, "gi"))].map(match => {
      let value = parsePromoDate(match[1], endOfDay);
      if (value === undefined) throw new Error("Некорректная дата официальной акции");
      const tail = normalized.slice(match.index! + match[0].length);
      const clock = tail.match(/^[\s,]*(?:г(?:ода|\.)?\s*)?(?:(?:в|до)\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(мск|по\s+московскому\s+времени)?/i);
      if (clock) {
        if (!clock[4] || Number(clock[1]) > 23 || Number(clock[2]) > 59 || Number(clock[3] ?? 0) > 59) {
          throw new Error("Неоднозначное время окончания или начала официальной акции");
        }
        value = parsePromoDate(match[1])! + (Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] ?? 0)) * 1000;
      }
      return value;
    });
    if (new Set(values).size > 1) throw new Error("Неоднозначные сроки официальной акции");
    return values[0];
  };
  const startsAt = read("с", false);
  const expiresAt = read("до|по", true);
  // Do not silently turn a visible but unsupported deadline into an unlimited offer.
  for (const match of normalized.matchAll(/(?:^|[\s(,;:])(?:до|по|с)\s+(\d{1,2}(?:[.]|\s+[а-яё]))/gi)) {
    const tail = normalized.slice(match.index! + match[0].indexOf(match[1]));
    if (/^\d{1,2}\.\d{1,2}|^\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i.test(tail)
      && !new RegExp(`^${fullDate}(?!\\d)`, "i").test(tail)) throw new Error("Срок акции указан без полного года или в неизвестном формате");
  }
  if (startsAt !== undefined && expiresAt !== undefined && startsAt > expiresAt) throw new Error("Конец акции раньше начала");
  return { startsAt, expiresAt };
}
