export type Company = {
  id: number;
  name: string;
  logo: string; // путь к картинке логотипа в /public/logos/
  color: string; // акцентный цвет бренда (HEX без #)
  bgColor: string; // цвет фона карточки (HEX без #)
  description: string;
  website: string;
};

/** The only supported merchant. Historical data stays on disk. */
export const VKUSVILL_ID = 54;
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
];
