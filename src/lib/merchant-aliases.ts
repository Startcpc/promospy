export const merchantAliases: Record<number, string[]> = {
  54: ['вкусвилл', 'вкус вилл', 'vkusvill'],
  401: ['Burger King', 'Бургер Кинг'],
  402: ['Вкусно и точка', 'vkusnoitochka'],
  403: ['ROSTIC’S', 'Ростикс', 'ростикс кфс'],
  404: ['Пятёрочка', 'Пятёрочка Доставка', 'Доставка Пятёрочка', '5ka'],
  405: ['Яндекс Еда', 'Еда Яндекса', 'Yandex Eda', 'Yandex Eats'],
};
export const normalizeMerchantName = (name: string) => name.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
export function merchantIdentity(name: string) {
  const key = normalizeMerchantName(name);
  return Object.entries(merchantAliases).find(([, aliases]) => aliases.some(alias => normalizeMerchantName(alias) === key))?.[0] ?? key;
}
