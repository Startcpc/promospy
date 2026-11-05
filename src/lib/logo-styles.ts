/**
 * Генератор стилизованных "логотипов" для пищевых брендов.
 * Поскольку simple-icons и Wikipedia могут быть ненадёжны для всех 50 брендов,
 * используем профессиональную типографическую обработку с фирменными цветами.
 *
 * Каждый логотип — это стилизованная текстовая композиция в фирменных цветах,
 * которая выглядит как настоящий брендовый знак.
 */

export type LogoStyle = {
  // Цвет фона карточки логотипа (HEX без #)
  bg: string;
  // Основной цвет текста (HEX без #)
  fg: string;
  // Дополнительный акцентный цвет (HEX без #)
  accent?: string;
  // Способ отображения имени
  variant:
    | "solid" // весь текст в fg на фоне bg
    | "two-tone" // часть имени в fg, часть в accent
    | "monogram" // одна-две буквы крупно в fg на фоне bg
    | "outline"; // контурный текст в fg на фоне bg
  // Сколько букв использовать в monogram-режиме
  letters?: number;
  // Текст логотипа (если отличается от названия)
  label?: string;
  // Кастомный CSS для шрифта
  fontClass?: string;
};

// Тонко настроенные логотипы для каждого бренда — фирменные цвета и стиль
export const logoStyles: Record<string, LogoStyle> = {
  // НАПИТКИ
  CocaCola: {
    bg: "D00009",
    fg: "FFFFFF",
    variant: "solid",
    label: "Coca-Cola",
    fontClass: "italic font-black tracking-tight",
  },
  PepsiCo: {
    bg: "FFFFFF",
    fg: "2151A1",
    accent: "E32726",
    variant: "two-tone",
    label: "Pepsi",
    fontClass: "font-black uppercase tracking-tight",
  },
  Nestlé: {
    bg: "FFFFFF",
    fg: "1A1A1A",
    accent: "CC0000",
    variant: "two-tone",
    label: "Nestlé",
    fontClass: "font-serif italic font-bold",
  },
  Fanta: {
    bg: "FF6600",
    fg: "FFFFFF",
    accent: "00A651",
    variant: "two-tone",
    label: "Fanta",
    fontClass: "italic font-black uppercase",
  },
  Sprite: {
    bg: "009B3A",
    fg: "FFFFFF",
    accent: "FFD700",
    variant: "two-tone",
    label: "Sprite",
    fontClass: "italic font-black uppercase",
  },
  "Dr Pepper": {
    bg: "7A1F2B",
    fg: "FFFFFF",
    variant: "solid",
    label: "Dr Pepper",
    fontClass: "font-serif italic font-bold",
  },
  "Red Bull": {
    bg: "001E5A",
    fg: "FFFFFF",
    accent: "FFCC00",
    variant: "two-tone",
    label: "Red Bull",
    fontClass: "font-black uppercase tracking-tight",
  },
  "Monster Energy": {
    bg: "000000",
    fg: "008C15",
    accent: "FFFFFF",
    variant: "two-tone",
    label: "MONSTER",
    fontClass: "font-black uppercase tracking-widest",
  },

  // ФАСТФУД
  "McDonald's": {
    bg: "FBC817",
    fg: "DA291C",
    variant: "monogram",
    letters: 1,
    label: "M",
    fontClass: "font-black",
  },
  "Burger King": {
    bg: "D62300",
    fg: "FFFFFF",
    accent: "F5EBDC",
    variant: "two-tone",
    label: "BURGER KING",
    fontClass: "font-black uppercase tracking-tight",
  },
  KFC: {
    bg: "000000",
    fg: "F8E11C",
    accent: "FFFFFF",
    variant: "solid",
    label: "KFC",
    fontClass: "font-black italic",
  },
  Starbucks: {
    bg: "006241",
    fg: "FFFFFF",
    variant: "solid",
    label: "STARBUCKS",
    fontClass: "font-black uppercase tracking-widest",
  },
  Subway: {
    bg: "008C15",
    fg: "FFD500",
    variant: "solid",
    label: "SUBWAY",
    fontClass: "font-black uppercase italic tracking-tight",
  },
  "Domino's": {
    bg: "0B6E4F",
    fg: "FFFFFF",
    accent: "E2231A",
    variant: "two-tone",
    label: "DOMINO'S",
    fontClass: "font-black uppercase tracking-tight",
  },
  "Pizza Hut": {
    bg: "E2231A",
    fg: "FFFFFF",
    variant: "solid",
    label: "Pizza Hut",
    fontClass: "font-black italic",
  },
  "Dunkin'": {
    bg: "FF671F",
    fg: "FFFFFF",
    accent: "FFD500",
    variant: "two-tone",
    label: "DUNKIN'",
    fontClass: "font-black uppercase italic",
  },
  "Wendy's": {
    bg: "E21934",
    fg: "FFFFFF",
    variant: "solid",
    label: "Wendy's",
    fontClass: "font-serif italic font-bold",
  },

  // КОФЕ
  Nescafé: {
    bg: "FFFFFF",
    fg: "CC0000",
    variant: "solid",
    label: "NESCAFÉ",
    fontClass: "font-black uppercase tracking-tight",
  },
  Nespresso: {
    bg: "000000",
    fg: "FFFFFF",
    accent: "B0A58E",
    variant: "two-tone",
    label: "NESPRESSO",
    fontClass: "font-black uppercase tracking-widest",
  },

  // СНЕКИ
  "Lay's": {
    bg: "FBBE1A",
    fg: "E2231A",
    accent: "FFFFFF",
    variant: "two-tone",
    label: "Lay's",
    fontClass: "italic font-black",
  },
  Doritos: {
    bg: "000000",
    fg: "E32726",
    accent: "FFB800",
    variant: "two-tone",
    label: "DORITOS",
    fontClass: "font-black uppercase italic tracking-tight",
  },
  Pringles: {
    bg: "FFFFFF",
    fg: "E32726",
    accent: "FFD500",
    variant: "two-tone",
    label: "Pringles",
    fontClass: "italic font-black",
  },

  // ШОКОЛАД И СЛАДОСТИ
  Oreo: {
    bg: "0033A0",
    fg: "FFFFFF",
    accent: "FFD500",
    variant: "two-tone",
    label: "OREO",
    fontClass: "font-black uppercase tracking-widest",
  },
  KitKat: {
    bg: "E1061C",
    fg: "FFFFFF",
    accent: "2B1E16",
    variant: "two-tone",
    label: "KitKat",
    fontClass: "font-black uppercase tracking-tight",
  },
  "M&M's": {
    bg: "000000",
    fg: "FFFFFF",
    accent: "FF6B00",
    variant: "two-tone",
    label: "m&m's",
    fontClass: "font-black lowercase italic",
  },
  Snickers: {
    bg: "2B1E16",
    fg: "FFFFFF",
    accent: "1A4D8F",
    variant: "two-tone",
    label: "SNICKERS",
    fontClass: "font-black uppercase tracking-tight",
  },
  Mars: {
    bg: "000000",
    fg: "FFFFFF",
    accent: "E1061C",
    variant: "two-tone",
    label: "MARS",
    fontClass: "font-black uppercase tracking-widest",
  },
  Ferrero: {
    bg: "002F6C",
    fg: "FFFFFF",
    accent: "FFD700",
    variant: "two-tone",
    label: "Ferrero",
    fontClass: "font-serif italic font-bold",
  },
  Nutella: {
    bg: "000000",
    fg: "FFFFFF",
    accent: "E30613",
    variant: "two-tone",
    label: "Nutella",
    fontClass: "font-black italic",
  },
  Toblerone: {
    bg: "000000",
    fg: "FFD700",
    accent: "E30613",
    variant: "two-tone",
    label: "TOBLERONE",
    fontClass: "font-black uppercase tracking-widest",
  },
  Lindt: {
    bg: "000000",
    fg: "FFD700",
    accent: "FFFFFF",
    variant: "two-tone",
    label: "LINDT",
    fontClass: "font-serif italic font-bold uppercase tracking-widest",
  },
  Haribo: {
    bg: "E30613",
    fg: "FFD500",
    accent: "FFFFFF",
    variant: "two-tone",
    label: "HARIBO",
    fontClass: "font-black uppercase tracking-widest",
  },
  Cadbury: {
    bg: "4B0082",
    fg: "FFD700",
    accent: "FFFFFF",
    variant: "two-tone",
    label: "Cadbury",
    fontClass: "font-serif italic font-bold",
  },
  Milka: {
    bg: "0099D8",
    fg: "FFFFFF",
    accent: "4B0082",
    variant: "two-tone",
    label: "milka",
    fontClass: "font-black lowercase italic",
  },
  Mondelez: {
    bg: "BD1B21",
    fg: "FFFFFF",
    accent: "FFD700",
    variant: "two-tone",
    label: "Mondelez",
    fontClass: "font-black uppercase tracking-tight",
  },

  // СОУСЫ
  Heinz: {
    bg: "08743F",
    fg: "FFFFFF",
    accent: "FFB81C",
    variant: "two-tone",
    label: "HEINZ",
    fontClass: "font-black italic uppercase tracking-widest",
  },
  "Hellmann's": {
    bg: "FFB81C",
    fg: "08743F",
    accent: "E2231A",
    variant: "two-tone",
    label: "Hellmann's",
    fontClass: "font-serif italic font-bold",
  },
  Knorr: {
    bg: "E31937",
    fg: "FFFFFF",
    accent: "FFD700",
    variant: "two-tone",
    label: "KNORR",
    fontClass: "font-black uppercase tracking-widest",
  },
  Unilever: {
    bg: "1F36C7",
    fg: "FFFFFF",
    accent: "00ADEF",
    variant: "two-tone",
    label: "Unilever",
    fontClass: "font-serif italic font-bold",
  },
  "Kraft Heinz": {
    bg: "E31937",
    fg: "FFFFFF",
    accent: "08743F",
    variant: "two-tone",
    label: "KRAFT HEINZ",
    fontClass: "font-black uppercase tracking-tight",
  },

  // ЗЕРНОВЫЕ
  "Kellogg's": {
    bg: "D8002A",
    fg: "FFFFFF",
    accent: "FFD500",
    variant: "two-tone",
    label: "Kellogg's",
    fontClass: "font-black italic",
  },
  "General Mills": {
    bg: "005DAA",
    fg: "FFFFFF",
    accent: "FFD500",
    variant: "two-tone",
    label: "General Mills",
    fontClass: "font-black uppercase tracking-tight",
  },
  Cheerios: {
    bg: "D8232A",
    fg: "FFFFFF",
    accent: "FFD500",
    variant: "two-tone",
    label: "Cheerios",
    fontClass: "font-black italic",
  },

  // МОЛОЧНЫЕ
  Danone: {
    bg: "00A9E0",
    fg: "FFFFFF",
    accent: "003D7A",
    variant: "two-tone",
    label: "DANONE",
    fontClass: "font-black uppercase tracking-widest",
  },

  // ФРУКТЫ
  Chiquita: {
    bg: "00A8E1",
    fg: "FFD500",
    accent: "006341",
    variant: "two-tone",
    label: "CHIQUITA",
    fontClass: "font-black uppercase italic tracking-tight",
  },
  Dole: {
    bg: "005226",
    fg: "FFD500",
    accent: "FFFFFF",
    variant: "two-tone",
    label: "DOLE",
    fontClass: "font-black uppercase tracking-widest",
  },
  Tropicana: {
    bg: "00A651",
    fg: "FFFFFF",
    accent: "FF6600",
    variant: "two-tone",
    label: "Tropicana",
    fontClass: "font-serif italic font-bold",
  },

  // ДЕСЕРТЫ
  "Baskin-Robbins": {
    bg: "D92E2A",
    fg: "FFFFFF",
    accent: "FFB81C",
    variant: "two-tone",
    label: "BASKIN-ROBBINS",
    fontClass: "font-black uppercase tracking-tight",
  },
  "Ben & Jerry's": {
    bg: "00ADEF",
    fg: "FFFFFF",
    accent: "FFD500",
    variant: "two-tone",
    label: "Ben & Jerry's",
    fontClass: "font-serif italic font-bold",
  },
  "Häagen-Dazs": {
    bg: "B8002F",
    fg: "FFD700",
    accent: "FFFFFF",
    variant: "two-tone",
    label: "Häagen-Dazs",
    fontClass: "font-serif italic font-bold uppercase tracking-tight",
  },
};

export function getLogoStyle(name: string): LogoStyle {
  return (
    logoStyles[name] ?? {
      bg: "1F1F1F",
      fg: "FFFFFF",
      variant: "solid",
      label: name,
      fontClass: "font-bold",
    }
  );
}
