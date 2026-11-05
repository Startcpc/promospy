#!/usr/bin/env python3
"""
Для логотипов с белым/почти белым фоном делает фон прозрачным.
Это позволяет логотипу "сидеть прямо на цветной карточке", а не быть
обрамлённым в белый блок.

Логика:
1. Загружаем логотип
2. Если у него нет альфа-канала (opaque) или углы белые —
   конвертируем в RGBA
3. Делаем белые и почти белые пиксели прозрачными (порог 240)
4. Обрезаем пустые края (auto-crop)
5. Сохраняем обратно как PNG
"""
import os
from pathlib import Path
from PIL import Image, ImageChops

LOGOS_DIR = Path("/home/z/my-project/public/logos")

# Список логотипов для обработки (те, у которых белый фон в картинке)
TO_PROCESS = [
    "black-pearl",       # белый фон
    "natura-siberica",   # белый фон
    "faberlic",          # белый фон
    "domik-v-derevne",   # белый фон
    "prostokvashino",    # почти белый фон
    "miratorg",          # почти белый фон
    "rostics",           # светло-серый фон
    "stars-coffee",      # белый фон
    "chistaya-liniya",   # светло-зелёный фон (тоже обработаем)
    "vkusvill",          # коричневый фон — пропустим (там сложный фон)
    "makfa",             # тёмно-зелёный — пропустим
    "dobry-cola",        # тёмно-коричневый — пропустим
    "teremok",           # красный фон — пропустим
    "vkusno-i-tochka",   # прозрачный — пропустим
]

WHITE_THRESHOLD = 240  # пиксели светлее этого значения считаем "белыми"

def make_white_transparent(img, threshold=WHITE_THRESHOLD):
    """Делает белые и почти белые пиксели прозрачными."""
    rgba = img.convert("RGBA")
    datas = rgba.getdata()
    new_data = []
    for item in datas:
        r, g, b, a = item
        # Если пиксель почти белый — делаем прозрачным
        if r >= threshold and g >= threshold and b >= threshold:
            new_data.append((r, g, b, 0))
        else:
            new_data.append((r, g, b, a))
    rgba.putdata(new_data)
    return rgba

def trim(img):
    """Обрезает пустые (полностью прозрачные) края."""
    bg = Image.new("RGBA", img.size, (0, 0, 0, 0))
    diff = ImageChops.difference(img, bg)
    bbox = diff.getbbox()
    if bbox:
        return img.crop(bbox)
    return img

def process(name):
    src = LOGOS_DIR / f"{name}.png"
    if not src.exists():
        print(f"  SKIP {name} (not found)")
        return False

    try:
        img = Image.open(src)
        original_size = img.size

        # Проверим — есть ли белые углы
        img_rgba = img.convert("RGBA")
        w, h = img_rgba.size
        corners = [img_rgba.getpixel((0, 0)), img_rgba.getpixel((w-1, 0)),
                   img_rgba.getpixel((0, h-1)), img_rgba.getpixel((w-1, h-1))]
        white_corners = sum(1 for c in corners if c[0] >= 240 and c[1] >= 240 and c[2] >= 240 and c[3] == 255)

        if white_corners < 3:
            print(f"  SKIP {name} (no white corners: {white_corners}/4)")
            return False

        # Делаем белый прозрачным
        transparent = make_white_transparent(img)

        # Обрезаем пустые края
        trimmed = trim(transparent)

        # Сохраняем
        trimmed.save(src, "PNG", optimize=True)
        print(f"  OK   {name}: {original_size} -> {trimmed.size}")
        return True
    except Exception as e:
        print(f"  FAIL {name}: {e}")
        return False

ok = 0
for name in TO_PROCESS:
    print(f"[{name}]")
    if process(name):
        ok += 1

print(f"\nProcessed: {ok}/{len(TO_PROCESS)}")
