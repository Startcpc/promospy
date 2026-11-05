#!/usr/bin/env python3
"""
Убирает тёмно-зелёный круг из логотипа «Вкусно — и точка».
Оставляет только картошки фри (оранжевые) и помидор (красный),
делая зелёный фон прозрачным. Карточка с зелёным фоном станет
единым «зелёным блоком» с едой.

Фильтр: пиксели, где красный канал заметно больше зелёного (R > G + 25) —
это оранжевые/красные элементы — оставляем. Остальное (зелёный круг) —
прозрачным.
"""
from PIL import Image, ImageChops
from pathlib import Path

SRC = Path("/home/z/my-project/public/logos/vkusno-i-tochka.png")

img = Image.open(SRC).convert("RGBA")
w, h = img.size
print(f"Original: {w}x{h}")

datas = img.getdata()
new_data = []
kept = 0
removed = 0
for item in datas:
    r, g, b, a = item
    if a == 0:
        new_data.append((r, g, b, 0))
        continue
    # Оранжевый (241,116,35): R > G. Красный (231,66,36): R > G.
    # Зелёный (15,88,61): R < G. Оставляем только "тёплые" пиксели.
    if r > g + 25 and r > 80:
        new_data.append((r, g, b, 255))
        kept += 1
    else:
        new_data.append((r, g, b, 0))
        removed += 1

img.putdata(new_data)
print(f"Kept pixels: {kept}, removed: {removed}")

# Обрезаем пустые края
bg = Image.new("RGBA", img.size, (0, 0, 0, 0))
diff = ImageChops.difference(img, bg)
bbox = diff.getbbox()
if bbox:
    img = img.crop(bbox)
print(f"After trim: {img.size}")

# Масштабируем до разумного размера (макс 512)
max_side = 512
if max(img.size) > max_side:
    ratio = max_side / max(img.size)
    img = img.resize((max(1, int(img.size[0] * ratio)), max(1, int(img.size[1] * ratio))), Image.LANCZOS)
    print(f"Resized: {img.size}")

img.save(SRC, "PNG", optimize=False, compress_level=0)
print(f"Saved: {SRC} ({SRC.stat().st_size}b)")
