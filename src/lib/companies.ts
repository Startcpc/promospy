export type Company = {
  id: number;
  name: string;
  logo: string;
  color: string;
  bgColor: string;
  description: string;
  website: string;
  category: "Продукты" | "Рестораны" | "Доставка";
  mark: string;
};

export const VKUSVILL_ID = 54;
export const MAGNIT_ID = 201;
export const METRO_ID = 209;
export const EDO_ID = 210;
export const FOX_ID = 211;
export const ALLO_ID = 212;
export const companies: Company[] = [
  { id: VKUSVILL_ID, name: "ВкусВилл", mark: "ВВ", category: "Продукты", logo: "/logos/vkusvill.png",
    color: "15653F", bgColor: "DDF2DD", description: "Продукты и готовая еда", website: "https://vkusvill.ru" },
  { id: 401, name: "Burger King", mark: "BK", category: "Рестораны", logo: "/logos/burger-king.png",
    color: "8B300F", bgColor: "FFD4AE", description: "Бургеры и комбо", website: "https://burgerkingrus.ru" },
  { id: 402, name: "Вкусно — и точка", mark: "В·Т", category: "Рестораны", logo: "/logos/vkusno-i-tochka.png",
    color: "005849", bgColor: "C9ECDB", description: "Завтраки, бургеры и кофе", website: "https://vkusnoitochka.ru" },
  { id: 403, name: "ROSTIC’S", mark: "R’S", category: "Рестораны", logo: "/logos/rostics.png",
    color: "9A1C31", bgColor: "FAD6D8", description: "Курица, баскеты и комбо", website: "https://rostics.ru" },
  { id: 404, name: "Пятёрочка", mark: "5", category: "Продукты", logo: "/logos/pyaterochka.png",
    color: "A52922", bgColor: "FFE3D2", description: "Продукты на каждый день", website: "https://5ka.ru" },
  { id: 405, name: "Яндекс Еда", mark: "Я", category: "Доставка", logo: "/logos/yandex-eda.png",
    color: "533E00", bgColor: "FFE675", description: "Доставка из ресторанов и магазинов", website: "https://eda.yandex.ru" },
  {
    id: MAGNIT_ID, category: "Продукты", mark: "М",
    name: "Магнит",
    logo: "/logos/magnit.png",
    color: "E32224",
    bgColor: "FFF0F0",
    description: "Продукты и доставка",
    website: "https://promo.magnit.ru/",
  },
  {
    id: METRO_ID, category: "Продукты", mark: "M",
    name: "METRO",
    logo: "/logos/metro.png",
    color: "004B8D",
    bgColor: "004B8D",
    description: "Продукты, товары для дома и доставка",
    website: "https://online.metro-cc.ru/promo/promocode/",
  },
  {
    id: EDO_ID, category: "Рестораны", mark: "Ё",
    name: "ЁДО Суши (Ковров)",
    logo: "/logos/edo.png",
    color: "B70C31",
    bgColor: "F9F4ED",
    description: "Суши и роллы в Коврове",
    website: "https://edosushi.ru/offers",
  },
  {
    id: FOX_ID, category: "Рестораны", mark: "F",
    name: "Fox Pizza (Иркутск)",
    logo: "/logos/fox.png",
    color: "D65016",
    bgColor: "FFF0E5",
    description: "Доставка пиццы в Иркутске",
    website: "https://fox-pizza.ru/promotions",
  },
  {
    id: ALLO_ID, category: "Рестораны", mark: "А",
    name: "Алло! Пицца (Москва)",
    logo: "/logos/allo.png",
    color: "B72432",
    bgColor: "FFF0F0",
    description: "Пицца в Москве",
    website: "https://allopizza.su/actions",
  },
];
