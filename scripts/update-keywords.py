#!/usr/bin/env python3
"""
Обновляет keywords для каждой компании (заменяет существующие).
"""
import re
from pathlib import Path

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
    "wildberries":        ["вб", "wb", "вайлдберриз", "вайлд", "berries", "wild"],
    "ozon-user":          ["озон", "ozon", "o3"],
    "tanuki-user":        ["тануки", "tanuki", "суши", "роллы", "японская"],
}

path = Path("/home/z/my-project/src/lib/companies.ts")
content = path.read_text(encoding="utf-8")

# Для каждой компании: находим её блок целиком и обновляем keywords
# Шаблон: блок от "{\n    id: N," до "\n  }"
# Внутри блока ищем logo и keywords

def update_block(match):
    block = match.group(0)
    # Извлечём slug из logo
    logo_m = re.search(r'logo:\s*"/logos/([^/.]+)\.', block)
    if not logo_m:
        return block
    slug = logo_m.group(1)
    kws = KEYWORDS.get(slug)
    if kws is None:
        return block
    kws_str = "[" + ", ".join(f'"{k}"' for k in kws) + "]"
    
    # Если keywords уже есть — заменим
    if re.search(r'keywords:\s*\[', block):
        block = re.sub(
            r'keywords:\s*\[[^\]]*\]',
            f'keywords: {kws_str}',
            block,
        )
    else:
        # Иначе добавим перед }
        block = block.rstrip().rstrip("}").rstrip() + f"\n    keywords: {kws_str},\n  }}"
    
    return block

# Применяем к каждому блоку
new_content = re.sub(
    r'\{\s*id:\s*\d+,.*?\n  \}',
    update_block,
    content,
    flags=re.DOTALL,
)

path.write_text(new_content, encoding="utf-8")

# Проверка
verify = path.read_text(encoding="utf-8")
# Найдём все keywords и покажем
kws_matches = re.findall(r'keywords:\s*(\[[^\]]*\])', verify)
print(f"Total keywords arrays: {len(kws_matches)}")
for i, k in enumerate(kws_matches):
    if k != "[]":
        print(f"  {i+1}. {k[:80]}")
