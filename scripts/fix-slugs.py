#!/usr/bin/env python3
"""Заменяет slug'и в companies.ts на правильные имена файлов логотипов."""
import re
from pathlib import Path

# Маппинг: старый slug -> новое имя файла (без расширения)
RENAME = {
    "cocacola": "coca-cola",
    "pepsico": "pepsico",
    "nestle": "nestle",
    "mcdonalds": "mcdonalds",
    "burgerking": "burger-king",
    "kfc": "kfc",
    "starbucks": "starbucks",
    "subway": "subway",
    "dominos": "dominos",
    "pizzahut": "pizza-hut",
    "dunkindonuts": "dunkin",
    "wendys": "wendys",
    "redbull": "red-bull",
    "monsterenergy": "monster-energy",
    "fanta": "fanta",
    "sprite": "sprite",
    "drpepper": "dr-pepper",
    "nescafe": "nescafe",
    "nespresso": "nespresso",
    "lays": "lays",
    "doritos": "doritos",
    "pringles": "pringles",
    "oreo": "oreo",
    "kitkat": "kitkat",
    "mms": "mms",
    "snickers": "snickers",
    "mars": "mars",
    "ferrero": "ferrero",
    "nutella": "nutella",
    "toblerone": "toblerone",
    "lindt": "lindt",
    "haribo": "haribo",
    "cadbury": "cadbury",
    "heinz": "heinz",
    "hellmanns": "hellmanns",
    "knorr": "knorr",
    "kelloggs": "kelloggs",
    "danone": "danone",
    "chiquita": "chiquita",
    "dole": "dole",
    "tropicana": "tropicana",
    "mondelezinternational": "mondelez",
    "unilever": "unilever",
    "generalmills": "general-mills",
    "kraftheinzcompany": "kraft-heinz",
    "baskinrobbins": "baskin-robbins",
    "benandjerrys": "ben-and-jerrys",
    "haagendazs": "haagen-dazs",
    "milka": "milka",
    "cheerios": "cheerios",
}

path = Path("/home/z/my-project/src/lib/companies.ts")
content = path.read_text(encoding="utf-8")

# Меняем тип: добавляем поле logo
content = content.replace(
    "export type Company = {\n  id: number;\n  name: string;\n  slug: string; // simple-icons slug for CDN: https://cdn.simpleicons.org/{slug}/{color}\n  color: string; // brand hex color (without #)",
    "export type Company = {\n  id: number;\n  name: string;\n  logo: string; // путь к картинке логотипа в /public/logos/\n  color: string; // акцентный цвет бренда (HEX без #)",
)

# Заменяем все slug: "...", на logo: "/logos/...png",
for old, new in RENAME.items():
    content = content.replace(
        f'    slug: "{old}",',
        f'    logo: "/logos/{new}.png",',
    )

path.write_text(content, encoding="utf-8")
print("Done. Verifying...")

# Проверка
import subprocess
r = subprocess.run(["grep", "-c", "logo:", str(path)], capture_output=True, text=True)
print(f"logo: occurrences = {r.stdout.strip()}")
r2 = subprocess.run(["grep", "-c", "slug:", str(path)], capture_output=True, text=True)
print(f"slug: remaining = {r2.stdout.strip()}")
