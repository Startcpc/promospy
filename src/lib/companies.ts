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
export const companies: Company[] = [
  { id: VKUSVILL_ID, name: "ВкусВилл", mark: "ВВ", category: "Продукты", logo: "/logos/vkusvill-user.png",
    color: "15653F", bgColor: "DDF2DD", description: "Продукты и готовая еда", website: "https://vkusvill.ru" },
  { id: 401, name: "Burger King", mark: "BK", category: "Рестораны", logo: "",
    color: "8B300F", bgColor: "FFD4AE", description: "Бургеры и комбо", website: "https://burgerkingrus.ru" },
  { id: 402, name: "Вкусно — и точка", mark: "В·Т", category: "Рестораны", logo: "",
    color: "005849", bgColor: "C9ECDB", description: "Завтраки, бургеры и кофе", website: "https://vkusnoitochka.ru" },
  { id: 403, name: "ROSTIC’S", mark: "R’S", category: "Рестораны", logo: "",
    color: "9A1C31", bgColor: "FAD6D8", description: "Курица, баскеты и комбо", website: "https://rostics.ru" },
  { id: 404, name: "Пятёрочка", mark: "5", category: "Продукты", logo: "",
    color: "A52922", bgColor: "FFE3D2", description: "Продукты на каждый день", website: "https://5ka.ru" },
  { id: 405, name: "Яндекс Еда", mark: "Я", category: "Доставка", logo: "",
    color: "533E00", bgColor: "FFE675", description: "Доставка из ресторанов и магазинов", website: "https://eda.yandex.ru" },
];
