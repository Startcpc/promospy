#!/usr/bin/env python3
"""
Обновляет companies.ts:
- Удаляет ушедшие из России бренды: Coca-Cola, McDonald's, Burger King, KFC, Starbucks
- Добавляет российские замены: Добрый Cola, Вкусно — и точка, Rostic's, Stars Coffee, Теремок
- Обновляет categories
"""
import re
from pathlib import Path

# ID для удаления (ушедшие из России)
REMOVE_IDS = {1, 4, 5, 6, 7}  # Coca-Cola, McDonald's, Burger King, KFC, Starbucks

# Новые российские бренды-замены
NEW_BRANDS = [
    {
        "id": 101,
        "name": "Добрый Cola",
        "logo": "/logos/dobry-cola.png",
        "color": "E30613",  # красный брендовый
        "category": "Безалкогольные напитки",
        "country": "Россия",
        "founded": 2022,
        "hq": "Москва, Россия",
        "product": "Газированные напитки",
        "description": "Российский бренд газированных напитков, запущенный компанией PepsiCo в 2022 году после ухода The Coca-Cola Company из России. Выпускает колу, лимонады и тонизирующие напитки.",
        "website": "https://dobrycolarussia.ru",
    },
    {
        "id": 102,
        "name": "Вкусно — и точка",
        "logo": "/logos/vkusno-i-tochka.png",
        "color": "C8102E",  # красный брендовый
        "category": "Быстрое питание",
        "country": "Россия",
        "founded": 2022,
        "hq": "Москва, Россия",
        "product": "Фастфуд",
        "description": "Российская сеть ресторанов быстрого питания, преемник McDonald's в России. Создана в 2022 году российским франчайзи на базе ресторанов McDonald's. Насчитывает более 850 заведений по всей стране.",
        "website": "https://vkusnoitochka.ru",
    },
    {
        "id": 103,
        "name": "Rostic's",
        "logo": "/logos/rostics.png",
        "color": "E2231A",  # красный брендовый
        "category": "Быстрое питание",
        "country": "Россия",
        "founded": 2023,
        "hq": "Москва, Россия",
        "product": "Фастфуд",
        "description": "Российская сеть ресторанов быстрого питания, преемник KFC в России. С 2023 года рестораны KFC были переименованы в Rostic's. Специализируется на блюдах из курицы.",
        "website": "https://rostics.ru",
    },
    {
        "id": 104,
        "name": "Stars Coffee",
        "logo": "/logos/stars-coffee.png",
        "color": "006241",  # зелёный брендовый
        "category": "Кофейни и мороженое",
        "country": "Россия",
        "founded": 2022,
        "hq": "Москва, Россия",
        "product": "Кофейни",
        "description": "Российская сеть кофеен, преемник Starbucks в России. Открыта в 2022 году российским франчайзи на базе заведений Starbucks. Сохраняет концепцию и оформление, предлагает кофе и десерты.",
        "website": "https://starscoffee.ru",
    },
    {
        "id": 105,
        "name": "Теремок",
        "logo": "/logos/teremok.png",
        "color": "C8102E",  # красный брендовый
        "category": "Быстрое питание",
        "country": "Россия",
        "founded": 1998,
        "hq": "Санкт-Петербург, Россия",
        "product": "Русские блины",
        "description": "Российская сеть ресторанов быстрого питания, специализирующаяся на русских блинах с начинками. Одна из крупнейших российских сетей фастфуда, основанная в Санкт-Петербурге.",
        "website": "https://teremok.ru",
    },
]


def json_dq(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


path = Path("/home/z/my-project/src/lib/companies.ts")
content = path.read_text(encoding="utf-8")

# Парсим все блоки компаний
pattern = re.compile(r'\{\s*id:\s*(\d+),.*?\}(?:,)?\s*(?=\{|\];)', re.DOTALL)
matches = list(pattern.finditer(content))
print(f"Found {len(matches)} company blocks")

# Фильтруем — оставляем тех, кого не в REMOVE_IDS
kept = []
for m in matches:
    cid = int(m.group(1))
    if cid not in REMOVE_IDS:
        block = m.group(0).rstrip().rstrip(',').rstrip()
        kept.append((cid, block))

print(f"After removal: {len(kept)} companies")

# Добавляем новые бренды
for brand in NEW_BRANDS:
    block = (
        "  {\n"
        f"    id: {brand['id']},\n"
        f"    name: {json_dq(brand['name'])},\n"
        f"    logo: {json_dq(brand['logo'])},\n"
        f"    color: {json_dq(brand['color'])},\n"
        f"    category: {json_dq(brand['category'])},\n"
        f"    country: {json_dq(brand['country'])},\n"
        f"    founded: {brand['founded']},\n"
        f"    hq: {json_dq(brand['hq'])},\n"
        f"    product: {json_dq(brand['product'])},\n"
        f"    description:\n"
        f"      {json_dq(brand['description'])},\n"
        f"    website: {json_dq(brand['website'])},\n"
        "  }"
    )
    kept.append((brand['id'], block))

print(f"After adding new: {len(kept)} companies")

# Сортируем по id
kept.sort(key=lambda x: x[0])

# Переписываем массив
new_companies = "export const companies: Company[] = [\n"
for cid, block in kept:
    new_companies += block + ",\n"
new_companies = new_companies.rstrip().rstrip(',') + "\n];"

# Заменяем весь блок companies
new_content = re.sub(
    r'export const companies: Company\[\] = \[.*?\];',
    new_companies,
    content,
    count=1,
    flags=re.DOTALL,
)

# Обновляем categories
present_cats = set()
for cid, block in kept:
    cat_match = re.search(r'category:\s*"([^"]+)"', block)
    if cat_match:
        present_cats.add(cat_match.group(1))

new_cats_order = [
    "Безалкогольные напитки",
    "Снеки",
    "Быстрое питание",
    "Кофейни и мороженое",
    "Шоколад и сладости",
    "Молочные продукты",
    "Кофе и чай",
    "Продукты питания",
    "Косметика",
]
new_cats = [c for c in new_cats_order if c in present_cats]
print(f"Categories: {new_cats}")

# Обновляем Category type
cat_union = " |\n  ".join(f'"{c}"' for c in new_cats)
new_cat_type = f"export type Category =\n  | {cat_union};"
new_content = re.sub(
    r'export type Category =\s*\|[^;]+;',
    new_cat_type,
    new_content,
    count=1,
    flags=re.DOTALL,
)

# Обновляем categories array
cat_array_items = ",\n  ".join(f'"{c}"' for c in new_cats)
new_cat_array = f"export const categories: Category[] = [\n  {cat_array_items},\n];"
new_content = re.sub(
    r'export const categories: Category\[\] = \[.*?\];',
    new_cat_array,
    new_content,
    count=1,
    flags=re.DOTALL,
)

path.write_text(new_content, encoding="utf-8")
print("Done.")
