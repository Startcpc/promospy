#!/usr/bin/env python3
"""
Обновляет companies.ts:
- Удаляет 10 американских/избыточных брендов (из текущих 20)
- Добавляет 10 российских брендов (еда/косметика/продукты)
- Обновляет categories
"""
import re
from pathlib import Path

# Удаляем эти id (выбраны как "лишние" или дублирующиеся по типу):
# 2=PepsiCo (дубль с Coca-Cola), 8=Subway (фастфуд дубль), 9=Domino's (фастфуд дубль),
# 10=Pizza Hut (фастфуд дубль), 13=Red Bull (напиток дубль), 15=Fanta (напиток дубль),
# 20=Lay's (снек), 21=Doritos (снек дубль), 23=Oreo (сладость дубль), 29=Nutella (сладость дубль)
REMOVE_IDS = {2, 8, 9, 10, 13, 15, 20, 21, 23, 29}

# Российские бренды для добавления
RU_BRANDS = [
    {
        "id": 51,
        "name": "Домик в деревне",
        "logo": "/logos/domik-v-derevne.png",
        "color": "0066B3",  # синий брендовый
        "category": "Молочные продукты",
        "country": "Россия",
        "founded": 1997,
        "hq": "Москва, Россия",
        "product": "Молочные продукты",
        "description": "Российский бренд молочных продуктов компании PepsiCo. Один из самых узнаваемых брендов молочной продукции в России, выпускает молоко, кефир, сметану, йогурты и творог.",
        "website": "https://www.domikvderevne.ru",
    },
    {
        "id": 52,
        "name": "Простоквашино",
        "logo": "/logos/prostokvashino.png",
        "color": "E30613",  # красный брендовый
        "category": "Молочные продукты",
        "country": "Россия",
        "founded": 2002,
        "hq": "Москва, Россия",
        "product": "Молочные продукты",
        "description": "Российский бренд молочных продуктов компании PepsiCo. Назван в честь деревни из произведения Эдуарда Успенского. Выпускает молоко, кефир, ряженку, йогурты, творог и десерты.",
        "website": "https://prostokvashino.ru",
    },
    {
        "id": 53,
        "name": "Макфа",
        "logo": "/logos/makfa.png",
        "color": "005BAC",  # синий брендовый
        "category": "Продукты питания",
        "country": "Россия",
        "founded": 1996,
        "hq": "Москва, Россия",
        "product": "Макаронные изделия",
        "description": "Крупнейший российский производитель макаронных изделий. Компания занимает лидирующие позиции на российском рынке макарон, экспортирует продукцию в более чем 30 стран мира.",
        "website": "https://www.makfa.ru",
    },
    {
        "id": 54,
        "name": "ВкусВилл",
        "logo": "/logos/vkusvill.png",
        "color": "4CAF50",  # зелёный брендовый
        "category": "Продукты питания",
        "country": "Россия",
        "founded": 2009,
        "hq": "Москва, Россия",
        "product": "Натуральные продукты",
        "description": "Российская сеть магазинов натуральных и полезных продуктов питания. Развивает собственную торговую марку, продаёт продукты без искусственных добавок через офлайн-магазины и онлайн.",
        "website": "https://vkusvill.ru",
    },
    {
        "id": 55,
        "name": "Мираторг",
        "logo": "/logos/miratorg.png",
        "color": "C8102E",  # красный брендовый
        "category": "Продукты питания",
        "country": "Россия",
        "founded": 1995,
        "hq": "Москва, Россия",
        "product": "Мясная продукция",
        "description": "Российская агропромышленная компания, крупнейший производитель мяса в России. Выращивает говядину, свинину, птицу, производит полуфабрикаты и замороженные продукты.",
        "website": "https://www.miratorg.ru",
    },
    {
        "id": 56,
        "name": "Чёрный жемчуг",
        "logo": "/logos/black-pearl.png",
        "color": "1A1A1A",  # чёрный брендовый
        "category": "Косметика",
        "country": "Россия",
        "founded": 1996,
        "hq": "Москва, Россия",
        "product": "Уходовая косметика",
        "description": "Российский бренд косметики по уходу за кожей, принадлежит компании Kalina (Unilever). Выпускает кремы, маски, сыворотки и средства для очищения кожи лица.",
        "website": "https://www.blackpearl.ru",
    },
    {
        "id": 57,
        "name": "Natura Siberica",
        "logo": "/logos/natura-siberica.png",
        "color": "2E7D32",  # зелёный брендовый
        "category": "Косметика",
        "country": "Россия",
        "founded": 2008,
        "hq": "Москва, Россия",
        "product": "Натуральная косметика",
        "description": "Российский бренд натуральной косметики, использующий сибирские травы и растения. Производит уходовую косметику для кожи и волос, продаётся более чем в 40 странах мира.",
        "website": "https://www.naturasiberica.ru",
    },
    {
        "id": 58,
        "name": "Чистая линия",
        "logo": "/logos/chistaya-liniya.png",
        "color": "00843D",  # зелёный брендовый
        "category": "Косметика",
        "country": "Россия",
        "founded": 1997,
        "hq": "Москва, Россия",
        "product": "Косметика по уходу",
        "description": "Российский бренд косметики по уходу за кожей и волосами. Один из лидеров массового сегмента российского рынка косметики, выпускает кремы, маски, шампуни и бальзамы.",
        "website": "https://www.chistaya-liniya.ru",
    },
    {
        "id": 59,
        "name": "Faberlic",
        "logo": "/logos/faberlic.png",
        "color": "6B2D8E",  # фиолетовый брендовый
        "category": "Косметика",
        "country": "Россия",
        "founded": 1997,
        "hq": "Москва, Россия",
        "product": "Косметика и парфюмерия",
        "description": "Российская косметическая компания, один из крупнейших в мире производителей косметики прямых продаж. Выпускает уходовую и декоративную косметику, парфюмерию, одежду и товары для дома.",
        "website": "https://faberlic.com",
    },
    {
        "id": 60,
        "name": "Красная линия",
        "logo": "/logos/krasnaya-liniya.png",
        "color": "C8102E",  # красный брендовый
        "category": "Косметика",
        "country": "Россия",
        "founded": 1992,
        "hq": "Москва, Россия",
        "product": "Косметика по уходу",
        "description": "Российский бренд косметики по уходу за кожей. Специализируется на средствах для проблемной и возрастной кожи, производит сыворотки, кремы и активные концентраты.",
        "website": "https://www.kr-liniya.ru",
    },
]

path = Path("/home/z/my-project/src/lib/companies.ts")
content = path.read_text(encoding="utf-8")


def json_dq(s):
    """Оборачивает строку в двойные кавычки с экранированием."""
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


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

# Добавляем российские бренды
for brand in RU_BRANDS:
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

print(f"After adding RU: {len(kept)} companies")

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

# Обновляем categories — оставляем только те, что есть
present_cats = set()
for cid, block in kept:
    cat_match = re.search(r'category:\s*"([^"]+)"', block)
    if cat_match:
        present_cats.add(cat_match.group(1))

# Новый порядок категорий
new_cats_order = [
    "Безалкогольные напитки",
    "Снеки",
    "Быстрое питание",
    "Кофейни и мороженое",
    "Шоколад и сладости",
    "Молочные продукты",
    "Кофе и чай",
    "Продукты питания",  # новая для российских
    "Косметика",  # новая для российских
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


def json_dq(s):
    """Оборачивает строку в двойные кавычки с экранированием."""
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'
