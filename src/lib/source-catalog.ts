/** Public merchant URLs from the catalogues’ published sitemaps, checked 2026-11-18. */
export type PublicCatalogue = { name: string; domain: string; pages: Record<number, string[]> };
export const PUBLIC_CATALOGUES: PublicCatalogue[] = [
  {name:'Пикабу',domain:'promokod.pikabu.ru',pages:{54:['https://promokod.pikabu.ru/shops/vkusvill'],
    401: ['https://promokod.pikabu.ru/shops/burgerkingrus'],
    402: ['https://promokod.pikabu.ru/shops/vkusnoitochka'],
    403: ['https://promokod.pikabu.ru/shops/kfc'],
    404: ['https://promokod.pikabu.ru/shops/5ka'],
    405: ['https://promokod.pikabu.ru/shops/eda-yandex'],
  }},
  {name:'Промокоди',domain:'promokodi.ru',pages:{54:['https://promokodi.ru/store/vkusvill/'],
    401: ['https://promokodi.ru/store/burger-king/'],
    402: ['https://promokodi.ru/store/vkusno-i-tochka/'],
    403: ['https://promokodi.ru/store/rostics/'],
    404: ['https://promokodi.ru/store/pyatyorochka/'],
    405: ['https://promokodi.ru/store/yandeks-eda/'],
  }},
  {name:'GetCashback',domain:'getcashback.ru',pages:{
    54: ['https://getcashback.ru/promocodes/vkusvill/'],
    401: ['https://getcashback.ru/promocodes/burgerking/'],
    402: ['https://getcashback.ru/promocodes/mcdonalds/'],
    403: ['https://getcashback.ru/promocodes/kfc/'],
  }},
  {name:'Promokod.com',domain:'promokod.com',pages:{54:['https://promokod.com/coupon-store/vkusvill-ru'],
    401: ['https://promokod.com/coupon-store/burger-king'],
    403: ['https://promokod.com/coupon-store/kfc-ru'],
    404: ['https://promokod.com/coupon-store/5ka-ru'],
    405: ['https://promokod.com/coupon-store/eda-yandex-ru'],
  }},
  {name:'Promocodex',domain:'promocodex.ru',pages:{54:['https://promocodex.ru/promocodes/vkusvill/'],
    401: ['https://promocodex.ru/promocodes/burgerking/'],
    402: ['https://promocodex.ru/promocodes/vkusnoitochka/'],
    403: ['https://promocodex.ru/promocodes/rostics/'],
    404: ['https://promocodex.ru/promocodes/5ka/'],
  }},
];
export const SEARCH_DOMAINS = PUBLIC_CATALOGUES.map(source => source.domain);
export function catalogueUrls(companyId: number) {
  return PUBLIC_CATALOGUES.flatMap(source => source.pages[companyId] ?? []);
}
/** Disabled sources stay out of both direct reading and index discovery. */
export const EXCLUDED_CATALOGUES = [
  {domain:'promokodus.com',reason:'Проверка браузера'},
  {domain:'okodo.ru',reason:'Страница ВкусВилл возвращает HTTP 404'},
  {domain:'promokod.7days.ru',reason:'Не удалось проверить robots.txt'},
  {domain:'kp.ru',reason:'Нет доступных полных кодов'},
  {domain:'tehnopanorama.ru',reason:'Нет доступных полных кодов'},
];
