#!/usr/bin/env python3
"""
Отформатирует пользовательские логотипы:
- обрезает пустые края
- масштабирует до макс 512px
- сохраняет пропорции
"""
from PIL import Image, ImageChops
from pathlib import Path

LOGOS_DIR = Path("/home/z/my-project/public/logos")
MAX_SIZE = 512

USER_LOGOS = [
    "tanuki-user",
    "ozon-user",
    "yandex-lavka-user",
    "yandex-market-user",
    "vkusvill-user",
    "magnit-user",
    "pyaterochka-user",
]

def trim_transparent(img):
    """Обрезает прозрачные края."""
    bg = Image.new("RGBA", img.size, (0, 0, 0, 0))
    diff = ImageChops.difference(img, bg)
    bbox = diff.getbbox()
    if bbox:
        return img.crop(bbox)
    return img

def trim_white(img, threshold=240):
    """Обрезает белые края (если фон почти белый)."""
    rgba = img.convert("RGBA")
    # Делаем белые пиксели прозрачными для обрезки
    datas = rgba.getdata()
    new_data = []
    for item in datas:
        r, g, b, a = item
        if r >= threshold and g >= threshold and b >= threshold and a == 255:
            new_data.append((r, g, b, 0))  # временно прозрачный
        else:
            new_data.append((r, g, b, a))
    rgba.putdata(new_data)
    
    # Обрезаем
    bg = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    diff = ImageChops.difference(rgba, bg)
    bbox = diff.getbbox()
    
    if bbox:
        # Возвращаем оригинал с обрезкой (с белым фоном)
        original = img.convert("RGBA").crop(bbox)
        return original
    return img

for name in USER_LOGOS:
    src = LOGOS_DIR / f"{name}.png"
    if not src.exists():
        print(f"{name}: NOT FOUND")
        continue
    
    img = Image.open(src).convert("RGBA")
    original_size = img.size
    w, h = img.size
    
    # Проверим углы
    corners = [
        img.getpixel((0, 0)),
        img.getpixel((w-1, 0)),
        img.getpixel((0, h-1)),
        img.getpixel((w-1, h-1)),
    ]
    transparent_corners = sum(1 for c in corners if c[3] < 200)
    white_corners = sum(1 for c in corners if c[0] >= 240 and c[1] >= 240 and c[2] >= 240 and c[3] == 255)
    
    print(f"\n[{name}] original: {w}x{h}, transparent_corners={transparent_corners}, white_corners={white_corners}")
    
    # Обрезаем
    if transparent_corners >= 3:
        # Прозрачный фон — обрезаем прозрачные края
        trimmed = trim_transparent(img)
        print(f"  trimmed transparent edges -> {trimmed.size}")
    elif white_corners >= 3:
        # Белый фон — обрезаем белые края, но сохраняем белый фон
        trimmed = trim_white(img)
        print(f"  trimmed white edges -> {trimmed.size}")
    else:
        # Цветной фон — не обрезаем
        trimmed = img
        print(f"  kept color background -> {trimmed.size}")
    
    # Масштабируем до MAX_SIZE по большей стороне
    tw, th = trimmed.size
    if max(tw, th) > MAX_SIZE:
        ratio = MAX_SIZE / max(tw, th)
        new_size = (max(1, int(tw * ratio)), max(1, int(th * ratio)))
        trimmed = trimmed.resize(new_size, Image.LANCZOS)
        print(f"  resized -> {trimmed.size}")
    
    # Сохраняем
    trimmed.save(src, "PNG", optimize=True)
    final_size = src.stat().st_size
    print(f"  saved: {trimmed.size}, {final_size}b")

print("\nDone!")
