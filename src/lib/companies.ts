export type Company = {
  id: number;
  name: string;
  logo: string; // путь к картинке логотипа в /public/logos/
  color: string; // акцентный цвет бренда (HEX без #)
  bgColor: string; // цвет фона карточки (HEX без #)
  category: Category;
  country: string;
  founded: number;
  hq: string;
  product: string;
  description: string;
  website: string;
  keywords: string[]; // алиасы для умного поиска
};

export type Category =
  | "Быстрое питание" |
  "Продукты питания" |
  "Магазины" |
  "Доставка" |
  "Маркетплейс";

export const categories: Category[] = [
  "Быстрое питание",
  "Продукты питания",
  "Магазины",
  "Доставка",
  "Маркетплейс",
];

export const companies: Company[] = [
  {
    id: 302, name: "Крошка Картошка", logo: "/logos/kroshka-kartoshka.svg",
    color: "217344", bgColor: "FFF8E8", category: "Быстрое питание",
    country: "Россия", founded: 1998, hq: "Москва, Россия", product: "Печёный картофель с наполнителями",
    description: "Российская сеть кафе. Печёный картофель с наполнителями, горячие блюда, салаты и напитки. Купоны и акции опубликованы на официальном сайте; условия доставки зависят от выбранного кафе.",
    website: "https://www.kartoshka.com/",
    keywords: ["крошка", "картошка", "крошка картошка", "крошка-картошка", "kartoshka", "kroshka"],
  },
  {
    id: 5,
    name: "Burger King",
    logo: "/logos/burger-king.png",
    color: "D62300",
    bgColor: "FFFFFF",
    category: "Быстрое питание",
    country: "США",
    founded: 1953,
    hq: "Майами-Дейд, Флорида",
    product: "Фастфуд",
    description:
      "Международная сеть ресторанов быстрого питания, специализирующаяся на гамбургерах. Известна своим фирменным сэндвичем Whopper. В России после 2022 года рестораны перешли под управление местных франчайзи.",
    website: "https://burgerkingrus.ru/",
    keywords: ["бк", "bk", "бургер", "king", "бургер кинг", "воппер", "whopper"],
  },
{
    id: 54,
    name: "ВкусВилл",
    logo: "/logos/vkusvill-user.png",
    color: "4CAF50",
    bgColor: "2DBD65",
    category: "Продукты питания",
    country: "Россия",
    founded: 2009,
    hq: "Москва, Россия",
    product: "Натуральные продукты",
    description:
      "Российская сеть магазинов натуральных и полезных продуктов питания. Развивает собственную торговую марку, продаёт продукты без искусственных добавок через офлайн-магазины и онлайн.",
    website: "https://vkusvill.ru",
    keywords: ["вв", "вкус вилл", "вкус", "vkusvill", "vkus", "vill", "вкусвилл"],
  },
  {
    id: 102,
    name: "Вкусно — и точка",
    logo: "/logos/vkusno-i-tochka.png",
    color: "C8102E",
    bgColor: "FFFFFF",
    category: "Быстрое питание",
    country: "Россия",
    founded: 2022,
    hq: "Москва, Россия",
    product: "Фастфуд",
    description:
      "Российская сеть ресторанов быстрого питания, преемник McDonald's в России. Создана в 2022 году российским франчайзи на базе ресторанов McDonald's. Насчитывает более 850 заведений по всей стране.",
    website: "https://vkusnoitochka.ru",
    keywords: ["вит", "вкусно", "точка", "макдоналдс", "mcdonalds", "мак", "vitt"],
  },
{
    id: 201,
    name: "Магнит",
    logo: "/logos/magnit-user.png",
    color: "E30613",
    bgColor: "FFFFFF",
    category: "Магазины",
    country: "Россия",
    founded: 1994,
    hq: "Краснодар, Россия",
    product: "Сеть магазинов",
    description:
      "Крупнейшая российская сеть продовольственных магазинов. Включает магазины «у дома», гипермаркеты и магазины косметики «Магнит Косметик». Активно развивает онлайн-сервисы доставки и предлагает промокоды для новых клиентов.",
    website: "https://magnit.ru",
    keywords: ["магнит", "маг", "mg", "magnit"],
  },
{
    id: 202,
    name: "Пятёрочка",
    logo: "/logos/pyaterochka-user.png",
    color: "E2231A",
    bgColor: "008F33",
    category: "Магазины",
    country: "Россия",
    founded: 1999,
    hq: "Санкт-Петербург, Россия",
    product: "Сеть магазинов",
    description:
      "Российская сеть магазинов «у дома», крупнейший продуктовый ретейлер России по числу магазинов. Принадлежит X5 Retail Group. Регулярно выпускает промокоды на доставку и покупки в приложении.",
    website: "https://5ka.ru",
    keywords: ["пятерочка", "пятера", "пятёрочка", "5ка", "5ka", "пятак", "x5"],
  },
{
    id: 203,
    name: "Яндекс Лавка",
    logo: "/logos/yandex-lavka-user.png",
    color: "FFCC00",
    bgColor: "01ADFF",
    category: "Доставка",
    country: "Россия",
    founded: 2019,
    hq: "Москва, Россия",
    product: "Доставка продуктов",
    description:
      "Сервис быстрой доставки продуктов и товаров повседневного спроса от Яндекса. Доставка за 15–30 минут. Постоянно предлагает промокоды на первые заказы и акции для постоянных клиентов.",
    website: "https://lavka.yandex.ru",
    keywords: ["лавка", "lavka", "я лавка", "yandex lavka", "ялавка"],
  },
{
    id: 204,
    name: "Яндекс Маркет",
    logo: "/logos/yandex-market-user.png",
    color: "FFCC00",
    bgColor: "FFFFFF",
    category: "Маркетплейс",
    country: "Россия",
    founded: 2000,
    hq: "Москва, Россия",
    product: "Маркетплейс",
    description:
      "Российский маркетплейс от Яндекса, где можно купить электронику, товары для дома, одежду, продукты и многое другое. Регулярно предлагает промокоды и скидки для новых и постоянных покупателей.",
    website: "https://market.yandex.ru",
    keywords: ["маркет", "market", "я маркет", "yandex market", "ямаркет"],
  },
{
    id: 205,
    name: "Перекрёсток",
    logo: "/logos/perekryostok-user.png",
    color: "43B02A",
    bgColor: "FFFFFF",
    category: "Магазины",
    country: "Россия",
    founded: 1995,
    hq: "Москва, Россия",
    product: "Супермаркеты",
    description:
      "Российская сеть супермаркетов, входящая в X5 Retail Group. Онлайн-сервис «Перекрёсток Впрок» доставляет продукты на дом. Предлагает промокоды на первые заказы и программу лояльности.",
    website: "https://www.perekrestok.ru",
    keywords: ["перекресток", "перекрёсток", "впрок", "perekrestok", "x5"],
  },
{
    id: 206,
    name: "Лента",
    logo: "/logos/lenta.png",
    color: "1A1A1A",
    bgColor: "FFFFFF",
    category: "Магазины",
    country: "Россия",
    founded: 1993,
    hq: "Санкт-Петербург, Россия",
    product: "Гипермаркеты",
    description:
      "Российская сеть гипермаркетов и супермаркетов. Развивает онлайн-доставку продуктов и товаров для дома. Регулярно предлагает промокоды и акции в приложении и на сайте.",
    website: "https://lenta.com",
    keywords: ["лента", "lenta", "лент"],
  },
{
    id: 207,
    name: "Wildberries",
    logo: "/logos/wildberries.png",
    color: "CB11AB",
    bgColor: "FFFFFF",
    category: "Маркетплейс",
    country: "Россия",
    founded: 2004,
    hq: "Москва, Россия",
    product: "Маркетплейс",
    description:
      "Крупнейший российский маркетплейс, где можно купить одежду, обувь, электронику, товары для дома, косметику и продукты. В sellers-кабинете и приложении часто действуют промокоды на скидки.",
    website: "https://www.wildberries.ru",
    keywords: ["вб", "wb", "вайлдберриз", "вайлд", "berries", "wild"],
  },
{
    id: 208,
    name: "Ozon",
    logo: "/logos/ozon-user.png",
    color: "005BFF",
    bgColor: "FFFFFF",
    category: "Маркетплейс",
    country: "Россия",
    founded: 1998,
    hq: "Москва, Россия",
    product: "Маркетплейс",
    description:
      "Российский маркетплейс, один из крупнейших в стране. Продаёт электронику, книги, одежду, продукты, товары для дома. Регулярно предлагает промокоды на первые покупки и сезонные акции.",
    website: "https://www.ozon.ru",
    keywords: ["озон", "ozon", "o3"],
  },
  {
    id: 301,
    name: "Tanuki",
    logo: "/logos/tanuki-user.png",
    color: "FE0000",
    bgColor: "FE0000",
    category: "Доставка",
    country: "Россия",
    founded: 2008,
    hq: "Санкт-Петербург, Россия",
    product: "Японская кухня",
    description:
      "Российская сеть ресторанов японской кухни и доставки. Специализируется на суши, роллах, WOK и горячих блюдах. Предлагает промокоды на доставку и регулярно проводит акции в приложении.",
    website: "https://tanukifamily.ru/tanuki/msk/",
    keywords: ["тануки", "tanuki", "суши", "роллы", "японская"],
  }
];
