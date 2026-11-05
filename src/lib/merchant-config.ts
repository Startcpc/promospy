// Store-specific browser selectors. A selector mismatch means unavailable, never expired.
export type CartConfig = {
  /** URL каталога для поиска товара */
  catalogUrl: string;
  /** Селектор кнопки "В корзину" */
  addToCartSelector: string;
  /** Селектор ссылки на корзину */
  cartLinkSelector: string;
  /** Селектор поля ввода промокода */
  promoInputSelector: string;
  /** Селектор кнопки "Применить" */
  applyButtonSelector: string;
  /** Селектор суммы заказа ДО промокода */
  totalBeforeSelector: string;
  /** Селектор суммы заказа ПОСЛЕ промокода */
  totalAfterSelector: string;
  /** Селектор сообщения об ошибке */
  errorSelector: string;
  /** Минимальная сумма заказа по умолчанию */
  defaultMinOrder: number;
  /** Сколько товаров добавить для достижения минимума */
  maxItemsToAdd: number;
  /** Опциональные шаги перед добавлением товара (выбор города, категории) */
  preSteps?: Array<{ type: "click" | "fill"; selector: string; value?: string; waitAfter?: number }>;
};

export const CART_CONFIGS: Record<number, CartConfig> = {
  // === Tanuki — суши-доставка ===
  301: {
    catalogUrl: "https://tanukifamily.ru/tanuki/msk/",
    preSteps: [
      // Москва уже выбрана по умолчанию через URL /moscow/
      { type: "click", selector: 'a[href*="menu"], [class*="menu-link"], button:has-text("Меню")', waitAfter: 1500 },
      { type: "click", selector: 'a[href*="rolly"], a:has-text("Роллы"), [class*="category"]:has-text("Роллы")', waitAfter: 1500 },
    ],
    addToCartSelector: 'button:has-text("В корзину"), [data-testid="add-to-cart"], .product-card__add-btn, [class*="add-to-cart"], [class*="product-add"]',
    cartLinkSelector: 'a[href*="cart"], [data-testid="cart-link"], [class*="cart-icon"], [class*="basket"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промо" i], input[name*="coupon" i], input[placeholder*="код" i]',
    applyButtonSelector: 'button:has-text("Применить"), button:has-text("Активировать")',
    totalBeforeSelector: '[class*="cart-total"], [data-testid="cart-total"], [class*="total-price"], [class*="summary"]',
    totalAfterSelector: '[class*="cart-total"], [data-testid="cart-total"], [class*="total-price"], [class*="summary"]',
    errorSelector: '[class*="error" i], [class*="invalid" i]',
    defaultMinOrder: 1090,
    maxItemsToAdd: 5,
  },
  // === Ozon — маркетплейс ===
  208: {
    catalogUrl: "https://www.ozon.ru/search/?text=карандаш&from_global=true",
    addToCartSelector: '[data-testid="add-to-cart-button"], button:has-text("В корзину"), [class*="add-to-cart"], [widget-data*="add-to-cart"]',
    cartLinkSelector: 'a[href*="/cart/"], [data-testid="cart-icon"], [class*="cart"], [aria-label*="Корзина"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промокод" i], input[placeholder*="код" i], input[placeholder*="купон" i]',
    applyButtonSelector: 'button:has-text("Применить"), button:has-text("Активировать")',
    totalBeforeSelector: '[data-testid="cart-total-price"], [class*="total-price"], [class*="cart-sum"]',
    totalAfterSelector: '[data-testid="cart-total-price"], [class*="total-price"], [class*="cart-sum"]',
    errorSelector: '[class*="error" i]',
    defaultMinOrder: 500,
    maxItemsToAdd: 3,
  },
  // === Wildberries — маркетплейс ===
  207: {
    catalogUrl: "https://www.wildberries.ru/catalog/0/search.aspx?search=карандаш",
    addToCartSelector: '[data-js-goods-add-to-basket], button:has-text("В корзину"), [class*="add-to-basket"], [class*="product-card__add"]',
    cartLinkSelector: 'a[href*="/lk/basket"], [class*="basket"], [class*="cart"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промокод" i], input[placeholder*="купон" i]',
    applyButtonSelector: 'button:has-text("Применить"), button:has-text("Активировать")',
    totalBeforeSelector: '.basket-price__price, [class*="total-price"], [class*="basket-sum"]',
    totalAfterSelector: '.basket-price__price, [class*="total-price"], [class*="basket-sum"]',
    errorSelector: '[class*="error" i]',
    defaultMinOrder: 500,
    maxItemsToAdd: 3,
  },
  // === Burger King — доставка ===
  5: {
    catalogUrl: "https://delivery.bk.ru/menu",
    preSteps: [
      // Иногда нужно выбрать адрес
      { type: "click", selector: 'button:has-text("Воппер"), [class*="category"]:has-text("Бургеры")', waitAfter: 1500 },
    ],
    addToCartSelector: '[data-testid="add-to-cart"], button:has-text("Добавить"), button:has-text("В корзину"), [class*="add-to-cart"]',
    cartLinkSelector: 'a[href*="cart"], [data-testid="cart-link"], [class*="cart"], [aria-label*="Корзина"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промокод" i], input[placeholder*="код" i]',
    applyButtonSelector: 'button:has-text("Применить"), button:has-text("Активировать")',
    totalBeforeSelector: '[class*="cart-total"], [data-testid="total"], [class*="summary"], [class*="order-sum"]',
    totalAfterSelector: '[class*="cart-total"], [data-testid="total"], [class*="summary"], [class*="order-sum"]',
    errorSelector: '[class*="error" i]',
    defaultMinOrder: 500,
    maxItemsToAdd: 3,
  },
  // === ВкусВилл — продукты ===
  54: {
    catalogUrl: "https://vkusvill.ru/goods/",
    addToCartSelector: 'button:has-text("В корзину"), [class*="add-to-cart"], [data-testid="add-to-cart"]',
    cartLinkSelector: 'a[href*="cart"], [class*="cart"], [data-testid="cart-link"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промокод" i]',
    applyButtonSelector: 'button:has-text("Применить")',
    totalBeforeSelector: '[class*="cart-total"], [class*="total-price"], [class*="summary"]',
    totalAfterSelector: '[class*="cart-total"], [class*="total-price"], [class*="summary"]',
    errorSelector: '[class*="error" i]',
    defaultMinOrder: 1500,
    maxItemsToAdd: 3,
  },
  // === Яндекс Лавка ===
  203: {
    catalogUrl: "https://lavka.yandex.ru/",
    addToCartSelector: 'button:has-text("В корзину"), [class*="add-to-cart"], [data-testid="add-to-cart"]',
    cartLinkSelector: 'a[href*="cart"], [class*="cart"], [data-testid="cart-link"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промокод" i]',
    applyButtonSelector: 'button:has-text("Применить")',
    totalBeforeSelector: '[class*="cart-total"], [class*="total-price"]',
    totalAfterSelector: '[class*="cart-total"], [class*="total-price"]',
    errorSelector: '[class*="error" i]',
    defaultMinOrder: 1000,
    maxItemsToAdd: 3,
  },
  // === Яндекс Маркет ===
  204: {
    catalogUrl: "https://market.yandex.ru/search?text=карандаш",
    addToCartSelector: 'button:has-text("В корзину"), [class*="add-to-cart"], [data-testid="add-to-cart"]',
    cartLinkSelector: 'a[href*="cart"], [class*="cart"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промокод" i]',
    applyButtonSelector: 'button:has-text("Применить")',
    totalBeforeSelector: '[class*="cart-total"], [class*="total-price"]',
    totalAfterSelector: '[class*="cart-total"], [class*="total-price"]',
    errorSelector: '[class*="error" i]',
    defaultMinOrder: 2000,
    maxItemsToAdd: 3,
  },
  // === Магнит ===
  201: {
    catalogUrl: "https://magnit.ru/catalog/",
    addToCartSelector: 'button:has-text("В корзину"), [class*="add-to-cart"]',
    cartLinkSelector: 'a[href*="cart"], [class*="cart"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промокод" i]',
    applyButtonSelector: 'button:has-text("Применить")',
    totalBeforeSelector: '[class*="cart-total"], [class*="total-price"]',
    totalAfterSelector: '[class*="cart-total"], [class*="total-price"]',
    errorSelector: '[class*="error" i]',
    defaultMinOrder: 1000,
    maxItemsToAdd: 3,
  },
  // === Пятёрочка ===
  202: {
    catalogUrl: "https://5ka.ru/catalog/",
    addToCartSelector: 'button:has-text("В корзину"), [class*="add-to-cart"]',
    cartLinkSelector: 'a[href*="cart"], [class*="cart"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промокод" i]',
    applyButtonSelector: 'button:has-text("Применить")',
    totalBeforeSelector: '[class*="cart-total"], [class*="total-price"]',
    totalAfterSelector: '[class*="cart-total"], [class*="total-price"]',
    errorSelector: '[class*="error" i]',
    defaultMinOrder: 1500,
    maxItemsToAdd: 3,
  },
  // === Перекрёсток ===
  205: {
    catalogUrl: "https://www.perekrestok.ru/cat/",
    addToCartSelector: 'button:has-text("В корзину"), [class*="add-to-cart"]',
    cartLinkSelector: 'a[href*="cart"], [class*="cart"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промокод" i]',
    applyButtonSelector: 'button:has-text("Применить")',
    totalBeforeSelector: '[class*="cart-total"], [class*="total-price"]',
    totalAfterSelector: '[class*="cart-total"], [class*="total-price"]',
    errorSelector: '[class*="error" i]',
    defaultMinOrder: 2000,
    maxItemsToAdd: 3,
  },
  // === Лента ===
  206: {
    catalogUrl: "https://lenta.com/catalog/",
    addToCartSelector: 'button:has-text("В корзину"), [class*="add-to-cart"]',
    cartLinkSelector: 'a[href*="cart"], [class*="cart"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промокод" i]',
    applyButtonSelector: 'button:has-text("Применить")',
    totalBeforeSelector: '[class*="cart-total"], [class*="total-price"]',
    totalAfterSelector: '[class*="cart-total"], [class*="total-price"]',
    errorSelector: '[class*="error" i]',
    defaultMinOrder: 2000,
    maxItemsToAdd: 3,
  },
  // === Вкусно — и точка ===
  102: {
    catalogUrl: "https://vkusnoitochka.ru/menu",
    addToCartSelector: 'button:has-text("В корзину"), [class*="add-to-cart"]',
    cartLinkSelector: 'a[href*="cart"], [class*="cart"]',
    promoInputSelector: 'input[name*="promo" i], input[placeholder*="промокод" i]',
    applyButtonSelector: 'button:has-text("Применить")',
    totalBeforeSelector: '[class*="cart-total"], [class*="total-price"]',
    totalAfterSelector: '[class*="cart-total"], [class*="total-price"]',
    errorSelector: '[class*="error" i]',
    defaultMinOrder: 500,
    maxItemsToAdd: 3,
  },
};

