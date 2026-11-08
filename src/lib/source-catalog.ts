/** Public catalogue pages observed on 2026-11-08. No coupon values or guessed slugs.
 * A page being indexed is not proof that it is readable from every network.
 * Access restrictions are evaluated again by the HTTP reader on each eligible scan.
 */
export type PublicCatalogue = { name:string; domain:string; pages:Record<number,string[]> };
const pikabu:Record<number,string>={5:'burgerkingrus',54:'vkusvill',102:'vkusnoitochka',201:'magnit-info',202:'5ka',203:'lavka-yandex',204:'market-yandex',205:'perekrestok',206:'lenta',207:'wildberries',208:'ozon',301:'tanuki',302:'kroshka-kartoshka'};
const promokodi:Record<number,string>={5:'burger-king',54:'vkusvill',102:'vkusno-i-tochka',201:'magnit-dostavka',202:'pyatyorochka',203:'yandex-lavka',204:'yandeks-market',205:'perekrestok',206:'lenta',207:'promokod-wildberries',208:'ozon-ru',301:'tanuki',302:'kroshka-kartoshka'};
const paths=(slugs:Record<number,string>,base:string,suffix='')=>Object.fromEntries(Object.entries(slugs).map(([id,slug])=>[id,[base+slug+suffix]]));
export const PUBLIC_CATALOGUES:PublicCatalogue[]=[
  {name:'Пикабу',domain:'promokod.pikabu.ru',pages:paths(pikabu,'https://promokod.pikabu.ru/shops/')},
  {name:'Промокоди',domain:'promokodi.ru',pages:paths(promokodi,'https://promokodi.ru/store/','/')},
  {name:'GetCashback',domain:'getcashback.ru',pages:paths({5:'burgerking',54:'vkusvill',201:'magnit'},'https://getcashback.ru/promocodes/','/')},
  {name:'Выберу',domain:'promokod.vbr.ru',pages:{5:['https://promokod.vbr.ru/shops/burger-king/']}},
  {name:'КП',domain:'kp.ru',pages:paths({54:'vkusvill',204:'yandex-market',208:'ozon'},'https://www.kp.ru/promokod/')},
  {name:'Mail.ru',domain:'promocodes.hi-tech.mail.ru',pages:{5:['https://promocodes.hi-tech.mail.ru/burger-king'],201:['https://promocodes.hi-tech.mail.ru/magnit']}},
  {name:'Okodo',domain:'okodo.ru',pages:{54:['https://okodo.ru/vkusvill/pervyj-zakaz/'],201:['https://okodo.ru/magnit/']}},
  {name:'Promokod.com',domain:'promokod.com',pages:paths({5:'burger-king',54:'vkusvill-ru',201:'magnit-ru'},'https://promokod.com/coupon-store/')},
  {name:'Промокодекс',domain:'promokodex.ru',pages:{201:['https://www.promokodex.ru/kupon/magnit-info']}},
  {name:'Промокоди.net',domain:'promokodi.net',pages:{201:['https://promokodi.net/store/magnit/']}},
  {name:'Фонтанка',domain:'fontanka.ru',pages:{201:['https://www.fontanka.ru/kupony/shop/magnit-dostavka/']}},
  {name:'Технопанорама',domain:'tehnopanorama.ru',pages:{54:['https://tehnopanorama.ru/promokod/vkusvill/']}},
  {name:'Promocodex',domain:'promocodex.ru',pages:paths({5:'burgerking',54:'vkusvill',102:'vkusnoitochka',201:'magnitdostavka',204:'yandexmarket'},'https://promocodex.ru/promocodes/','/')},
  {name:'7days',domain:'promokod.7days.ru',pages:paths({5:'burger-king',54:'vkus-villa',201:'magnit'},'https://promokod.7days.ru/promokod-')},
  {name:'ToBeCash',domain:'tobecash.ru',pages:{201:['https://www.tobecash.ru/coupons-magnit-promokod']}},
  {name:'ПромКод',domain:'promkod.ru',pages:paths({5:'burgerking.ru',203:'lavka.yandex',204:'market.yandex.ru',208:'ozon.ru'},'https://www.promkod.ru/shop/')},
  {name:'БериКод',domain:'berikod.ru',pages:{204:['https://berikod.ru/yandex.market/']}},
  {name:'Picodi',domain:'picodi.com',pages:{204:['https://www.picodi.com/ru/marketyandex']}},
  {name:'Промокоды Маркета',domain:'promokod-marketa.ru',pages:{204:['https://promokod-marketa.ru/']}},
  {name:'Промокодофф',domain:'promokodoff.ru',pages:{208:['https://promokodoff.ru/promokody-ozon/']}},
];
export const SEARCH_DOMAINS=PUBLIC_CATALOGUES.map(source=>source.domain);
export function catalogueUrls(companyId:number){return [...new Set(PUBLIC_CATALOGUES.flatMap(source=>source.pages[companyId]??[]))];}
// Deliberately excluded from discovery as well as direct seeds: a challenge-only
// source and general forums / paid voucher stores are not public code catalogues.
export const EXCLUDED_CATALOGUES=[{domain:'promokodus.com',reason:'Проверка браузера; отключён по умолчанию'}];
