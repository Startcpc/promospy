#!/usr/bin/env python3
"""Обновляет пути logo в companies.ts на правильные расширения (.jpg/.png)."""
import os
from pathlib import Path

logos_dir = Path("/home/z/my-project/public/logos")
# Строим map: basename -> реальное имя файла с расширением
file_map = {}
for f in logos_dir.iterdir():
    if f.is_file() and f.stem:
        file_map[f.stem] = f.name  # "coca-cola" -> "coca-cola.jpg"

companies_path = Path("/home/z/my-project/src/lib/companies.ts")
content = companies_path.read_text(encoding="utf-8")

import re

def replace_logo(match):
    slug = match.group(1)
    if slug in file_map:
        return f'    logo: "/logos/{file_map[slug]}",'
    print(f"WARNING: no file for slug '{slug}'")
    return match.group(0)

# Меняем: logo: "/logos/{slug}.png", -> logo: "/logos/{slug}.{real_ext}",
new_content = re.sub(r'    logo: "/logos/([a-z0-9-]+)\.png",', replace_logo, content)

companies_path.write_text(new_content, encoding="utf-8")

# Проверка
png_left = new_content.count('.png"')
jpg_count = new_content.count('.jpg"')
print(f"Done. .png references left: {png_left}, .jpg references: {jpg_count}")
print(f"Total logo: occurrences: {new_content.count('logo:')}")
