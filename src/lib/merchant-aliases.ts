/** Aliases identify the supported merchant; abbreviations never prove ownership. */
export const merchantAliases: Record<number, string[]> = {
  54: ['вкусвилл', 'вкус вилл', 'vkusvill'],
  201: ['магнит', 'magnit'],
  209: ['метро', 'metro'],
  210: ['ёдо суши', 'ёдо', 'edosushi'],
  211: ['fox pizza', 'foxpizza', 'фокс пицца', 'фокс pizza'],
  212: ['алло пицца', 'allopizza'],
};
export const normalizeMerchantName = (name: string) => name.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
