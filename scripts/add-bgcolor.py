#!/usr/bin/env python3
"""Добавляет поле bgColor для каждой компании с цветом фона карточки."""
import re
from pathlib import Path

# slug -> bg color (HEX without #)
# Для каждого бренда подобран фон, на котором логотип виден.
# Если у логотипа есть свой фон — берём его.
# Если логотип прозрачный — берём очень светлый tint фирменного цвета,
# чтобы логотип был виден и у каждой карточки был свой оттенок.
BG_COLORS = {
    # Иностранные, продолжающие работу в РФ (прозрачные PNG)
    "nestle": "F5F5F5",          # чёрный текст → светло-серый
    "nescafe": "FFF1F1",         # красный текст → светло-розовый
    "kitkat": "FFF1F1",          # красный текст → светло-розовый
    "snickers": "F5F5F5",        # тёмный текст → светло-серый
    "ferrero": "FFF6E8",         # золотой текст → светло-бежевый

    # Российские — еда/продукты
    "domik-v-derevne": "F0F6FF",  # у лого белый фон → светло-голубой tint
    "prostokvashino": "FFF1F1",   # красный → светло-розовый
    "makfa": "021601",            # у лого тёмно-зелёный фон
    "vkusvill": "5F5244",         # у лого коричневый фон
    "miratorg": "FFF1F1",         # красный → светло-розовый
    "dobry-cola": "1A0500",       # у лого тёмно-коричневый фон
    "vkusno-i-tochka": "0B6E4F",  # брендовый зелёный (логотип белый/оранжевый)
    "rostics": "FFF1F1",          # красный → светло-розовый
    "stars-coffee": "006241",     # брендовый зелёный (как Starbucks)
    "teremok": "E0082F",          # у лого красный фон

    # Российская косметика
    "black-pearl": "F5F5F5",      # чёрный текст → светло-серый
    "natura-siberica": "F0FAF0",  # зелёный → светло-зелёный
    "chistaya-liniya": "C2E6B8",  # у лого светло-зелёный фон
    "faberlic": "F8F0FA",         # фиолетовый → светло-лиловый
    "krasnaya-liniya": "FFF1F1",  # красный → светло-розовый
}

path = Path("/home/z/my-project/src/lib/companies.ts")
content = path.read_text(encoding="utf-8")

# 1. Гарантируем, что bgColor есть в типе Company (если ещё нет)
if "bgColor: string;" not in content:
    content = content.replace(
        "  color: string; // акцентный цвет бренда (HEX без #)",
        "  color: string; // акцентный цвет бренда (HEX без #)\n  bgColor: string; // цвет фона карточки (HEX без #)",
    )

# 2. Для каждой компании:
#    - если bgColor нет — добавляем после color
#    - если bgColor есть — обновляем значение по slug

# Сначала добавим bgColor там, где его ещё нет
def add_bgcolor(match):
    logo_path = match.group(1)
    color = match.group(2)
    slug = logo_path.split('/')[-1].replace('.png', '').replace('.jpg', '').replace('.jpeg', '')
    bg = BG_COLORS.get(slug, "FFFFFF")
    return f'    logo: "{logo_path}",\n    color: "{color}",\n    bgColor: "{bg}",'

content = re.sub(
    r'    logo: "([^"]+)",\n    color: "([A-Fa-f0-9]+)",(?!\n    bgColor:)',
    add_bgcolor,
    content,
)

# Теперь обновим существующие bgColor по slug
def update_bgcolor(match):
    logo_path = match.group(1)
    slug = logo_path.split('/')[-1].replace('.png', '').replace('.jpg', '').replace('.jpeg', '')
    bg = BG_COLORS.get(slug, match.group(3))  # если slug не найден, оставляем старое
    return f'    logo: "{logo_path}",\n    color: "{match.group(2)}",\n    bgColor: "{bg}",'

content = re.sub(
    r'    logo: "([^"]+)",\n    color: "([A-Fa-f0-9]+)",\n    bgColor: "([A-Fa-f0-9]+)",',
    update_bgcolor,
    content,
)

path.write_text(content, encoding="utf-8")

# Проверка
verify = path.read_text(encoding="utf-8")
count = verify.count("bgColor:")
print(f"bgColor: occurrences = {count} (expected 21: 1 type + 20 companies)")
