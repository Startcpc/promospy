/** Public merchant URLs observed again on 2026-11-09. No guessed slugs or codes. */
export type PublicCatalogue = { name: string; domain: string; pages: Record<number, string[]> };
export const PUBLIC_CATALOGUES: PublicCatalogue[] = [
  {name:'Пикабу',domain:'promokod.pikabu.ru',pages:{54:['https://promokod.pikabu.ru/shops/vkusvill']}},
  {name:'Промокоди',domain:'promokodi.ru',pages:{54:['https://promokodi.ru/store/vkusvill/']}},
  {name:'GetCashback',domain:'getcashback.ru',pages:{54:['https://getcashback.ru/promocodes/vkusvill/']}},
  {name:'Promokod.com',domain:'promokod.com',pages:{54:['https://promokod.com/coupon-store/vkusvill-ru']}},
  {name:'Promocodex',domain:'promocodex.ru',pages:{54:['https://promocodex.ru/promocodes/vkusvill/']}},
];
export const SEARCH_DOMAINS = PUBLIC_CATALOGUES.map(source => source.domain);
export function catalogueUrls(companyId: number) {
  return companyId === 54 ? PUBLIC_CATALOGUES.flatMap(source => source.pages[54]) : [];
}
/** Disabled sources stay out of both direct reading and index discovery. */
export const EXCLUDED_CATALOGUES = [
  {domain:'promokodus.com',reason:'Проверка браузера'},
  {domain:'okodo.ru',reason:'Страница ВкусВилл возвращает HTTP 404'},
  {domain:'promokod.7days.ru',reason:'Не удалось проверить robots.txt'},
  {domain:'kp.ru',reason:'Нет доступных полных кодов'},
  {domain:'tehnopanorama.ru',reason:'Нет доступных полных кодов'},
];
