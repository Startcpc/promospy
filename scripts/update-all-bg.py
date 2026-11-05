#!/usr/bin/env python3
"""
Обновляет bgColor для каждой компании на основе анализа логотипов.
Фон карточки = фону логотипа (или светлый tint фирменного цвета для прозрачных).
"""
import re
from pathlib import Path

# slug → правильный bgColor
BG_COLORS = {
    "burger-king":        "FBEDEA",  # прозрачный → светло-розовый tint красного
    "vkusvill-user":      "2DBD65",  # фон логотипа зелёный
    "vkusno-i-tochka":    "FAEBEE",  # прозрачный → светло-розовый tint красного
    "magnit-user":        "F8C0C4",  # есть красный угол → розовый
    "pyaterochka-user":   "008F33",  # фон логотипа зелёный
    "yandex-lavka-user":  "02ADFF",  # фон логотипа голубой
    "yandex-market-user": "FFFFFF",  # фон логотипа белый
    "perekryostok-user":  "EFF8ED",  # прозрачный → светло-зелёный tint
    "lenta":              "001E4B",  # фон логотипа тёмно-синий!
    "wildberries":        "FAEBF8",  # прозрачный → светло-фиолетовый tint
    "ozon-user":          "EAF1FF",  # прозрачный → светло-голубой tint
    "tanuki-user":        "FE0000",  # фон логотипа красный
}

path = Path("/home/z/my-project/src/lib/companies.ts")
content = path.read_text(encoding="utf-8")

# Для каждой компании: найдём её блок и обновим bgColor
def update_block(match):
    block = match.group(0)
    # Извлечём slug из logo
    logo_m = re.search(r'logo:\s*"/logos/([^/.]+)\.', block)
    if not logo_m:
        return block
    slug = logo_m.group(1)
    new_bg = BG_COLORS.get(slug)
    if not new_bg:
        return block
    
    # Заменим bgColor
    block = re.sub(
        r'(bgColor:\s*")[A-Fa-f0-9]+(")',
        f'\\g<1>{new_bg}\\g<2>',
        block,
    )
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
print("Текущие bgColor:")
for m in re.finditer(r'logo:\s*"/logos/([^/.]+)\.[^"]+".*?bgColor:\s*"([A-Fa-f0-9]+)"', verify, re.DOTALL):
    slug = m.group(1)
    bg = m.group(2)
    expected = BG_COLORS.get(slug, "?")
    mark = "✓" if bg == expected else "✗"
    print(f"  {mark} {slug}: #{bg} (ожидается #{expected})")
