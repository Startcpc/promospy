export type Company = {
  id: number;
  name: string;
  logo: string; // путь к картинке логотипа в /public/logos/
  color: string; // акцентный цвет бренда (HEX без #)
  bgColor: string; // цвет фона карточки (HEX без #)
  description: string;
  website: string;
};

export const VKUSVILL_ID = 54;
export const MAGNIT_ID = 201;
export const METRO_ID = 209;
export const EDO_ID = 210;
export const FOX_ID = 211;
export const ALLO_ID = 212;
export const companies: Company[] = [
  {
    id: VKUSVILL_ID,
    name: "ВкусВилл",
    logo: "/logos/vkusvill-user.png",
    color: "4CAF50",
    bgColor: "2DBD65",
    description:
      "Российская сеть магазинов натуральных и полезных продуктов питания. Развивает собственную торговую марку, продаёт продукты без искусственных добавок через офлайн-магазины и онлайн.",
    website: "https://vkusvill.ru",
  },
  {
    id: MAGNIT_ID,
    name: "Магнит",
    logo: "/logos/magnit.png",
    color: "E32224",
    bgColor: "FFF0F0",
    description: "Промокоды Магнит для доставки и других указанных на официальной странице услуг.",
    website: "https://promo.magnit.ru/",
  },
  {
    id: METRO_ID,
    name: "METRO",
    logo: "/logos/metro.png",
    color: "004B8D",
    bgColor: "EDF5FC",
    description: "Промокоды доставки METRO. Минимальная сумма заказа зависит от региона.",
    website: "https://online.metro-cc.ru/promo/promocode/",
  },
  {
    id: EDO_ID,
    name: "ЁДО Суши (Ковров)",
    logo: "/logos/edo.png",
    color: "B70C31",
    bgColor: "B70C31",
    description: "Промокоды и подарки из раздела акций «ЁДО Суши» в Коврове.",
    website: "https://edosushi.ru/offers",
  },
  {
    id: FOX_ID,
    name: "Fox Pizza (Иркутск)",
    logo: "/logos/fox.png",
    color: "D65016",
    bgColor: "FFF0E5",
    description: "Промокоды Fox Pizza из официального раздела акций Иркутска.",
    website: "https://fox-pizza.ru/promotions",
  },
  {
    id: ALLO_ID,
    name: "Алло! Пицца (Москва)",
    logo: "/logos/allo.png",
    color: "B72432",
    bgColor: "FFF0F0",
    description: "Промокоды из официального раздела акций «Алло! Пицца» для Москвы.",
    website: "https://allopizza.su/actions",
  },
];
