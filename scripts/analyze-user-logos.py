#!/usr/bin/env python3
"""
Анализирует пользовательские логотипы:
- определяет размер
- проверяет угловые пиксели (чтобы понять фон)
- предлагает bgColor для каждой карточки
"""
from PIL import Image
from pathlib import Path

LOGOS_DIR = Path("/home/z/my-project/public/logos")

USER_LOGOS = [
    "tanuki-user",       # Tanuki — красный фон
    "ozon-user",         # Ozon — синий/розовый фон
    "yandex-lavka-user", # Яндекс Лавка — голубой фон
    "yandex-market-user",# Яндекс Маркет — белый фон
    "vkusvill-user",     # ВкусВилл — зелёный фон
    "magnit-user",       # Магнит — красный фон
    "pyaterochka-user",  # Пятёрочка — зелёный фон
]

for name in USER_LOGOS:
    src = LOGOS_DIR / f"{name}.png"
    if not src.exists():
        print(f"{name}: NOT FOUND")
        continue
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    # Угловые пиксели
    corners = [
        img.getpixel((0, 0)),
        img.getpixel((w-1, 0)),
        img.getpixel((0, h-1)),
        img.getpixel((w-1, h-1)),
    ]
    # Средний цвет углов
    avg_r = sum(c[0] for c in corners) // 4
    avg_g = sum(c[1] for c in corners) // 4
    avg_b = sum(c[2] for c in corners) // 4
    avg_a = sum(c[3] for c in corners) // 4
    
    # Проверим, есть ли прозрачные углы
    transparent = sum(1 for c in corners if c[3] < 200)
    
    # Определим "основной" цвет фона
    if transparent >= 3:
        bg_type = "transparent"
        bg_color = "FFFFFF"  # по умолчанию белый
    else:
        bg_type = f"opaque (avg: #{avg_r:02X}{avg_g:02X}{avg_b:02X})"
        bg_color = f"{avg_r:02X}{avg_g:02X}{avg_b:02X}"
    
    print(f"{name}:")
    print(f"  size: {w}x{h}")
    print(f"  corners: {corners}")
    print(f"  bg_type: {bg_type}")
    print(f"  suggested bgColor: #{bg_color}")
    print()
