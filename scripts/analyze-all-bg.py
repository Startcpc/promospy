#!/usr/bin/env python3
"""
Анализирует все 12 логотипов и определяет правильный bgColor для каждой карточки.
Проверяет:
1. Есть ли у логотипа свой цветной фон (непрозрачные углы)
2. Если да — берёт цвет фона логотипа
3. Если прозрачный — берёт светлый tint фирменного цвета
"""
import re
from PIL import Image
from pathlib import Path

LOGOS_DIR = Path("/home/z/my-project/public/logos")

# Список всех 12 компаний с их slug
COMPANIES = [
    ("burger-king",        "D62300"),  # красный брендовый
    ("vkusvill-user",      "4CAF50"),  # зелёный
    ("vkusno-i-tochka",    "C8102E"),
    ("magnit-user",        "E30613"),
    ("pyaterochka-user",   "E2231A"),
    ("yandex-lavka-user",  "FFCC00"),
    ("yandex-market-user", "FFCC00"),
    ("perekryostok-user",  "43B02A"),
    ("lenta",              "1A1A1A"),
    ("wildberries",        "CB11AB"),
    ("ozon-user",          "005BFF"),
    ("tanuki-user",        "FE0000"),
]

def hex_to_light_tint(hex_color, lightness=0.92):
    """Делает из тёмного цвета очень светлый tint."""
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    # Смешиваем с белым
    r = int(r + (255 - r) * lightness)
    g = int(g + (255 - g) * lightness)
    b = int(b + (255 - b) * lightness)
    return f"{r:02X}{g:02X}{b:02X}"

results = {}
for slug, brand_color in COMPANIES:
    src = LOGOS_DIR / f"{slug}.png"
    if not src.exists():
        print(f"{slug}: NOT FOUND")
        continue
    
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    # Берём углы с небольшим отступом
    margin = max(2, min(w, h) // 30)
    corners = [
        img.getpixel((margin, margin)),
        img.getpixel((w - 1 - margin, margin)),
        img.getpixel((margin, h - 1 - margin)),
        img.getpixel((w - 1 - margin, h - 1 - margin)),
    ]
    
    transparent_corners = sum(1 for c in corners if c[3] < 200)
    # Проверим средний цвет углов (для непрозрачных)
    if transparent_corners < 3:
        # Углы непрозрачные — значит у логотипа есть свой фон
        avg_r = sum(c[0] for c in corners) // 4
        avg_g = sum(c[1] for c in corners) // 4
        avg_b = sum(c[2] for c in corners) // 4
        bg_hex = f"{avg_r:02X}{avg_g:02X}{avg_b:02X}"
        bg_type = f"OPAQUE bg #{bg_hex}"
        suggested = bg_hex
    else:
        # Прозрачный фон — берём светлый tint фирменного цвета
        tint = hex_to_light_tint(brand_color, 0.92)
        bg_type = f"TRANSPARENT → tint of #{brand_color} = #{tint}"
        suggested = tint
    
    print(f"{slug}: {w}x{h}")
    print(f"  corners: {corners}")
    print(f"  {bg_type}")
    print(f"  suggested bgColor: #{suggested}")
    print()
    results[slug] = suggested

print("\n=== Для вставки в скрипт ===")
for slug, bg in results.items():
    print(f'    "{slug}": "{bg}",')
