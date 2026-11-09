/** Aliases identify the supported merchant; abbreviations never prove ownership. */
export const merchantAliases: Record<number, string[]> = {
  54: ['вкусвилл', 'вкус вилл', 'vkusvill'],
};
export const normalizeMerchantName = (name: string) => name.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
