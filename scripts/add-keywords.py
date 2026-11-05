#!/usr/bin/env python3
"""
Добавляет поле keywords для каждой компании — для умного поиска.
Например: Burger King → ["бк", "bk", "бургер", "king", "бургер кинг", "вк"]
Пользователь вводит "бу" → находит "Burger King" (через "бургер")
Пользователь вводит "бк" → находит "Burger King" (через "бк")
"""
import re
from pathlib import Path

# slug → keywords (slug = имя файла без расширения, как в logo path)
KEYWORDS = {
    "burger-king":        ["бк", "bk", "бургер", "king", "бургер кинг", "воппер", "whopper"],
    "vkusvill-user":      ["вв", "вкус вилл", "вкус", "vkusvill", "vkus", "vill", "вкусвилл"],
    "vkusno-i-tochka":    ["вит", "вкусно", "точка", "макдоналдс", "mcdonalds", "мак", "vitt"],
    "magnit-user":        ["магнит", "маг", "mg", "magnit"],
    "pyaterochka-user":   ["пятерочка", "пятера", "пятёрочка", "5ка", "5ka", "пятак", "x5"],
    "yandex-lavka-user":  ["лавка", "lavka", "я лавка", "yandex lavka", "ялавка"],
    "yandex-market-user": ["маркет", "market", "я маркет", "yandex market", "ямаркет"],
    "perekryostok-user":  ["перекресток", "перекрёсток", "впрок", "perekrestok", "x5"],
    "lenta":              ["лента", "lenta", "лент"],
    "wildberries":        ["вб", "wb", "вайлдберриз", "вайлд", "berries", "wild", "вбшник"],
    "ozon-user":          ["озон", "ozon", "o3"],
    "tanuki-user":        ["тануки", "tanuki", "суши", "роллы", "японская"],
}

path = Path("/home/z/my-project/src/lib/companies.ts")
content = path.read_text(encoding="utf-8")

# 1. Добавляем keywords в тип Company
if "keywords:" not in content.split("export type Company")[1].split("};")[0]:
    content = content.replace(
        "  website: string;",
        "  website: string;\n  keywords: string[]; // алиасы для умного поиска",
    )

# 2. Для каждой компании добавляем keywords после website
# Ищем: website: "...",\n  }  и добавляем keywords перед }

def add_keywords(match):
    website_val = match.group(1)
    # Найдём slug из logo выше по тексту — нельзя, делаем иначе:
    # Извлечём из всего блока logo path
    block_start = match.start()
    # Найдём logo в этом блоке (ищем назад)
    block_text = content[:block_start].split("{")[-1] if "{" in content[:block_start] else ""
    # Простой способ: найдём logo: "/logos/{slug}.png" в последних 500 символах до match
    pre = content[max(0, block_start - 800):block_start]
    logo_match = re.search(r'logo:\s*"/logos/([^/.]+)\.', pre)
    slug = logo_match.group(1) if logo_match else ""
    kws = KEYWORDS.get(slug, [])
    kws_str = "[" + ", ".join(f'"{k}"' for k in kws) + "]"
    return f'    website: "{website_val}",\n    keywords: {kws_str},\n  }}'

content = re.sub(
    r'    website: "([^"]+)",\n  \}',
    add_keywords,
    content,
)

path.write_text(content, encoding="utf-8")

# Проверка
verify = path.read_text(encoding="utf-8")
count = verify.count("keywords:")
print(f"keywords: occurrences = {count} (expected 13: 1 type + 12 companies)")
