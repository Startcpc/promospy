#!/usr/bin/env python3
"""
Обновляет список компаний:
- Удаляет тех, у кого нет сайта с промокодами (косметика без промокодов, и т.д.)
- Оставляет подходящие иностранные бренды (Nescafé, KitKat, Snickers, Ferrero)
- Оставляет российские бренды, у которых есть сайт с промокодами
- Добавляет: Магнит, Пятёрочка, Яндекс Лавка, Яндекс Маркет, Перекрёсток, Лента, Wildberries, Ozon
- Заменяет логотип ВкусВилла на новый
"""
import re
from pathlib import Path

# ID для удаления (нет сайтов с промокодами или косметика не подходит)
# Удаляем: Nestle (нет промокодов), Макфа (нет промокодов), Мираторг (нет),
# Чёрный жемчуг, Natura Siberica, Чистая линия, Faberlic, Красная линия (косметика — нет промокодов),
# Вкусно-и-точка, Rostic's, Stars Coffee, Теремок, Домик в деревне, Простоквашино (нет промокодов)
# Оставляем: Nescafé, KitKat, Snickers, Ferrero (иногда есть), ВкусВилл, Добрый Cola
REMOVE_IDS = {3, 53, 55, 56, 57, 58, 59, 60, 102, 103, 104, 105, 51, 52}
# 3=Nestlé, 53=Макфа, 55=Мираторг, 56=Чёрный жемчуг, 57=Natura Siberica,
# 58=Чистая линия, 59=Faberlic, 60=Красная линия, 102=Вкусно-и-точка,
# 103=Rostic's, 104=Stars Coffee, 105=Теремок, 51=Домик в деревне, 52=Простоквашино

# Новые компании — магазины и маркетплейсы с промокодами
NEW_BRANDS = [
    {
        "id": 201,
        "name": "Магнит",
        "logo": "/logos/magnit.png",
        "color": "E30613",  # красный
        "bgColor": "FFF1F1",
        "category": "Магазины",
        "country": "Россия",
        "founded": 1994,
        "hq": "Краснодар, Россия",
        "product": "Сеть магазинов",
        "description": "Крупнейшая российская сеть продовольственных магазинов. Включает магазины «у дома», гипермаркеты и магазины косметики «Магнит Косметик». Активно развивает онлайн-сервисы доставки и предлагает промокоды для новых клиентов.",
        "website": "https://magnit.ru",
    },
    {
        "id": 202,
        "name": "Пятёрочка",
        "logo": "/logos/pyaterochka.png",
        "color": "E2231A",  # красный
        "bgColor": "FFF1F1",
        "category": "Магазины",
        "country": "Россия",
        "founded": 1999,
        "hq": "Санкт-Петербург, Россия",
        "product": "Сеть магазинов",
        "description": "Российская сеть магазинов «у дома», крупнейший продуктовый ретейлер России по числу магазинов. Принадлежит X5 Retail Group. Регулярно выпускает промокоды на доставку и покупки в приложении.",
        "website": "https://5ka.ru",
    },
    {
        "id": 203,
        "name": "Яндекс Лавка",
        "logo": "/logos/yandex-lavka.png",
        "color": "FFCC00",  # жёлтый Яндекс
        "bgColor": "FFFAE0",
        "category": "Доставка",
        "country": "Россия",
        "founded": 2019,
        "hq": "Москва, Россия",
        "product": "Доставка продуктов",
        "description": "Сервис быстрой доставки продуктов и товаров повседневного спроса от Яндекса. Доставка за 15–30 минут. Постоянно предлагает промокоды на первые заказы и акции для постоянных клиентов.",
        "website": "https://lavka.yandex.ru",
    },
    {
        "id": 204,
        "name": "Яндекс Маркет",
        "logo": "/logos/yandex-market.png",
        "color": "FFCC00",  # жёлтый Яндекс
        "bgColor": "FFFAE0",
        "category": "Маркетплейс",
        "country": "Россия",
        "founded": 2000,
        "hq": "Москва, Россия",
        "product": "Маркетплейс",
        "description": "Российский маркетплейс от Яндекса, где можно купить электронику, товары для дома, одежду, продукты и многое другое. Регулярно предлагает промокоды и скидки для новых и постоянных покупателей.",
        "website": "https://market.yandex.ru",
    },
    {
        "id": 205,
        "name": "Перекрёсток",
        "logo": "/logos/perekryostok.png",
        "color": "43B02A",  # зелёный
        "bgColor": "F0FAF0",
        "category": "Магазины",
        "country": "Россия",
        "founded": 1995,
        "hq": "Москва, Россия",
        "product": "Супермаркеты",
        "description": "Российская сеть супермаркетов, входящая в X5 Retail Group. Онлайн-сервис «Перекрёсток Впрок» доставляет продукты на дом. Предлагает промокоды на первые заказы и программу лояльности.",
        "website": "https://www.perekrestok.ru",
    },
    {
        "id": 206,
        "name": "Лента",
        "logo": "/logos/lenta.png",
        "color": "1A1A1A",  # чёрный
        "bgColor": "F5F5F5",
        "category": "Магазины",
        "country": "Россия",
        "founded": 1993,
        "hq": "Санкт-Петербург, Россия",
        "product": "Гипермаркеты",
        "description": "Российская сеть гипермаркетов и супермаркетов. Развивает онлайн-доставку продуктов и товаров для дома. Регулярно предлагает промокоды и акции в приложении и на сайте.",
        "website": "https://lenta.com",
    },
    {
        "id": 207,
        "name": "Wildberries",
        "logo": "/logos/wildberries.png",
        "color": "CB11AB",  # фиолетовый WB
        "bgColor": "F8F0FA",
        "category": "Маркетплейс",
        "country": "Россия",
        "founded": 2004,
        "hq": "Москва, Россия",
        "product": "Маркетплейс",
        "description": "Крупнейший российский маркетплейс, где можно купить одежду, обувь, электронику, товары для дома, косметику и продукты. В sellers-кабинете и приложении часто действуют промокоды на скидки.",
        "website": "https://www.wildberries.ru",
    },
    {
        "id": 208,
        "name": "Ozon",
        "logo": "/logos/ozon.png",
        "color": "005BFF",  # синий Ozon
        "bgColor": "F0F4FF",
        "category": "Маркетплейс",
        "country": "Россия",
        "founded": 1998,
        "hq": "Москва, Россия",
        "product": "Маркетплейс",
        "description": "Российский маркетплейс, один из крупнейших в стране. Продаёт электронику, книги, одежду, продукты, товары для дома. Регулярно предлагает промокоды на первые покупки и сезонные акции.",
        "website": "https://www.ozon.ru",
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

# Фильтруем
kept = []
for m in matches:
    cid = int(m.group(1))
    if cid not in REMOVE_IDS:
        block = m.group(0).rstrip().rstrip(',').rstrip()
        kept.append((cid, block))

print(f"After removal: {len(kept)} companies")

# Заменим логотип ВкусВилла на новый
for i, (cid, block) in enumerate(kept):
    if cid == 54:  # ВкусВилл
        new_block = block.replace("/logos/vkusvill.png", "/logos/vkusvill-new.png")
        kept[i] = (cid, new_block)
        print("Updated ВкусВилл logo to vkusvill-new.png")

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
    "Шоколад и сладости",
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
