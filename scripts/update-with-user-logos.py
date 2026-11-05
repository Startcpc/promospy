#!/usr/bin/env python3
"""
Обновляет companies.ts:
- Убирает: Nescafé (18), KitKat (24), Snickers (26), Ferrero (28), Добрый Cola (101)
- Возвращает: Burger King (5), Вкусно — и точка (102)
- Добавляет: Tanuki (301) — японская сеть ресторанов
- Обновляет logo и bgColor для 6 пользовательских фото:
  ВкусВилл, Магнит, Пятёрочка, Яндекс Лавка, Яндекс Маркет, Ozon
"""
import re
from pathlib import Path

REMOVE_IDS = {18, 24, 26, 28, 101}

# slug -> (новый logo путь, новый bgColor)
UPDATE = {
    54:  {"logo": "/logos/vkusvill-user.png",        "bgColor": "2DBD65"},  # ВкусВилл — зелёный фон логотипа
    201: {"logo": "/logos/magnit-user.png",          "bgColor": "FFFFFF"},  # Магнит — белый фон, красный логотип
    202: {"logo": "/logos/pyaterochka-user.png",     "bgColor": "008F33"},  # Пятёрочка — зелёный фон логотипа
    203: {"logo": "/logos/yandex-lavka-user.png",    "bgColor": "01ADFF"},  # Яндекс Лавка — голубой фон
    204: {"logo": "/logos/yandex-market-user.png",   "bgColor": "FFFFFF"},  # Яндекс Маркет — белый фон
    208: {"logo": "/logos/ozon-user.png",            "bgColor": "FFFFFF"},  # Ozon — белый фон
}

# Новые бренды
NEW_BRANDS = [
    {
        "id": 5,
        "name": "Burger King",
        "logo": "/logos/burger-king.png",
        "color": "D62300",
        "bgColor": "FFF1F1",  # светло-розовый под красный бренд
        "category": "Быстрое питание",
        "country": "США",
        "founded": 1953,
        "hq": "Майами-Дейд, Флорида",
        "product": "Фастфуд",
        "description": "Международная сеть ресторанов быстрого питания, специализирующаяся на гамбургерах. Известна своим фирменным сэндвичем Whopper. В России после 2022 года рестораны перешли под управление местных франчайзи.",
        "website": "https://www.bk.com",
    },
    {
        "id": 102,
        "name": "Вкусно — и точка",
        "logo": "/logos/vkusno-i-tochka.png",
        "color": "C8102E",
        "bgColor": "0B6E4F",  # зелёный брендовый (логотип белый/оранжевый)
        "category": "Быстрое питание",
        "country": "Россия",
        "founded": 2022,
        "hq": "Москва, Россия",
        "product": "Фастфуд",
        "description": "Российская сеть ресторанов быстрого питания, преемник McDonald's в России. Создана в 2022 году российским франчайзи на базе ресторанов McDonald's. Насчитывает более 850 заведений по всей стране.",
        "website": "https://vkusnoitochka.ru",
    },
    {
        "id": 301,
        "name": "Tanuki",
        "logo": "/logos/tanuki-user.png",
        "color": "FE0000",
        "bgColor": "FE0000",  # красный фон логотипа
        "category": "Доставка",
        "country": "Россия",
        "founded": 2008,
        "hq": "Санкт-Петербург, Россия",
        "product": "Японская кухня",
        "description": "Российская сеть ресторанов японской кухни и доставки. Специализируется на суши, роллах, WOK и горячих блюдах. Предлагает промокоды на доставку и регулярно проводит акции в приложении.",
        "website": "https://www.tanuki.ru",
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

# Фильтруем и обновляем
kept = []
for m in matches:
    cid = int(m.group(1))
    if cid in REMOVE_IDS:
        continue
    block = m.group(0).rstrip().rstrip(',').rstrip()
    
    # Обновляем logo и bgColor если нужно
    if cid in UPDATE:
        upd = UPDATE[cid]
        # Меняем logo путь
        block = re.sub(
            r'(    logo: ")[^"]+(",)',
            f'\\g<1>{upd["logo"]}\\g<2>',
            block,
        )
        # Меняем bgColor
        block = re.sub(
            r'(    bgColor: ")[A-Fa-f0-9]+(",)',
            f'\\g<1>{upd["bgColor"]}\\g<2>',
            block,
        )
        print(f"  Updated id={cid}: logo={upd['logo']}, bgColor={upd['bgColor']}")
    
    kept.append((cid, block))

print(f"After removal/update: {len(kept)} companies")

# Добавляем новые бренды
for brand in NEW_BRANDS:
    block = (
        "  {\n"
        f"    id: {brand['id']},\n"
        f"    name: {json_dq(brand['name'])},\n"
        f"    logo: {json_dq(brand['logo'])},\n"
        f"    color: {json_dq(brand['color'])},\n"
        f"    bgColor: {json_dq(brand['bgColor'])},\n"
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
    "Быстрое питание",
    "Кофе и чай",
    "Продукты питания",
    "Магазины",
    "Доставка",
    "Маркетплейс",
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
