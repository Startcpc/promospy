// Date-only values mean a Moscow calendar day, independently of server timezone.
export function parsePromoDate(value: unknown, endOfDay = false): number | undefined {
  if (typeof value === "number" || (typeof value === "string" && /^\d{10}(?:\d{3})?$/.test(value))) {
    const raw = Number(value);
    const timestamp = raw < 100_000_000_000 ? raw * 1000 : raw;
    return Number.isFinite(timestamp) && timestamp >= 946684800000 && timestamp < 4102444800000 ? timestamp : undefined;
  }
  if (typeof value !== "string") return undefined;
  let date = value.trim();
  const englishMonths=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const dayFirst=date.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})$/i);
  const monthFirst=date.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if(dayFirst||monthFirst){
    const name=(dayFirst?.[2]??monthFirst![1]).toLowerCase(),month=englishMonths.findIndex(item=>item===name||item.slice(0,3)===name);
    if(month<0)return undefined;
    date=String((dayFirst??monthFirst)![3])+'-'+String(month+1).padStart(2,'0')+'-'+String(dayFirst?.[1]??monthFirst![2]).padStart(2,'0');
  }
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const written = date.toLocaleLowerCase("ru").match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{4})(?:\s*г(?:ода|\.)?)?$/);
  if (written) {
    const month = months.indexOf(written[2]) + 1;
    if (!month) return undefined;
    date = `${written[3]}-${String(month).padStart(2, "0")}-${written[1].padStart(2, "0")}`;
  }
  const ru = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ru) date = `${ru[3]}-${ru[2].padStart(2, "0")}-${ru[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const validation = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(validation.getTime()) || validation.toISOString().slice(0, 10) !== date) return undefined;
    date += endOfDay ? "T23:59:59.999+03:00" : "T00:00:00+03:00";
  }
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(date)) return undefined;
  const clock = date.match(/T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:Z|[+-]\d{2}:?\d{2})$/i);
  if (!clock || Number(clock[1]) > 24 || Number(clock[2]) > 59 || Number(clock[3] ?? 0) > 59) return undefined;
  if (Number(clock[1]) === 24 && (Number(clock[2]) !== 0 || Number(clock[3] ?? 0) !== 0 || /[1-9]/.test(clock[4] ?? ''))) return undefined;
  const calendar = date.slice(0, 10);
  const validation = new Date(`${calendar}T00:00:00Z`);
  if (!Number.isFinite(validation.getTime()) || validation.toISOString().slice(0, 10) !== calendar) return undefined;
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
