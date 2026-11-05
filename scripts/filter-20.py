#!/usr/bin/env python3
"""Оставляет только 20 самых узнаваемых компаний и обновляет categories."""
import re
from pathlib import Path

# 20 самых узнаваемых брендов (по id из companies.ts)
KEEP_IDS = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15, 18, 20, 21, 23, 24, 26, 28, 29}
# 1=Coca-Cola, 2=PepsiCo, 3=Nestlé, 4=McDonald's, 5=Burger King, 6=KFC,
# 7=Starbucks, 8=Subway, 9=Domino's, 10=Pizza Hut, 13=Red Bull, 15=Fanta,
# 18=Nescafé, 20=Lay's, 21=Doritos, 23=Oreo, 24=KitKat, 26=Snickers,
# 28=Ferrero, 29=Nutella

path = Path("/home/z/my-project/src/lib/companies.ts")
content = path.read_text(encoding="utf-8")

# Парсим все блоки компаний
# Каждый блок: {  id: N,  ... }, (или последний без запятой)
pattern = re.compile(r'\{\s*id:\s*(\d+),.*?\}(?:,)?\s*(?=\{|\];)', re.DOTALL)
matches = list(pattern.finditer(content))
print(f"Found {len(matches)} company blocks")

kept = []
for m in matches:
    cid = int(m.group(1))
    if cid in KEEP_IDS:
        # Нормализуем: убираем конечную запятую, добавим обратно
        block = m.group(0).rstrip().rstrip(',').rstrip() + ','
        kept.append((cid, block))

print(f"Keeping {len(kept)} companies")
assert len(kept) == 20, f"Expected 20, got {len(kept)}"

# Сортируем по id
kept.sort(key=lambda x: x[0])

# Переписываем массив
new_companies = "export const companies: Company[] = [\n"
for cid, block in kept:
    # Делаем отступ
    indented = '\n'.join('  ' + line if not line.startswith('  ') else line for line in block.split('\n'))
    new_companies += "  " + indented.lstrip() + "\n"
# Убираем последнюю запятую
new_companies = new_companies.rstrip().rstrip(',') + "\n];"

# Заменяем весь блок companies
new_content = re.sub(
    r'export const companies: Company\[\] = \[.*?\];',
    new_companies,
    content,
    count=1,
    flags=re.DOTALL,
)

# Обновляем categories — оставляем только те, что есть в выбранных компаниях
present_cats = set()
for cid, block in kept:
    cat_match = re.search(r'category:\s*"([^"]+)"', block)
    if cat_match:
        present_cats.add(cat_match.group(1))

# Порядок категорий как в исходном массиве
old_cats = [
    "Безалкогольные напитки",
    "Снеки",
    "Быстрое питание",
    "Кофейни и мороженое",
    "Шоколад и сладости",
    "Молочные продукты",
    "Кофе и чай",
    "Соусы и приправы",
    "Зерновые и завтраки",
    "Фрукты и соки",
]
new_cats = [c for c in old_cats if c in present_cats]
print(f"Categories kept: {new_cats}")

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
print("Done. Verifying...")

# Проверка
verify = path.read_text(encoding="utf-8")
import subprocess
r = subprocess.run(["grep", "-c", "id:", str(path)], capture_output=True, text=True)
print(f"Companies count: {r.stdout.strip()}")
r2 = subprocess.run(["grep", "-c", '"category":', str(path)], capture_output=True, text=True)
print(f"category: occurrences (note: type+array+items): {r2.stdout.strip()}")
