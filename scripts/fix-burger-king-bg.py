#!/usr/bin/env python3
"""
Убирает бежевый прямоугольный фон у логотипа Burger King.

Подход: flood-fill от всех 4 углов, удаляем все «бежевые» пиксели
(R > 230, G > 200, B > 180, без выраженного оранжевого/красного оттенка).
Оранжевые булочки и красный текст логотипа образуют замкнутый контур и
не дают заливке проникнуть внутрь бургера — так бежевая СЕРЕДИНКА булочки
(где написано «BURGER KING») сохраняется, а бежевый фон вокруг — удаляется.
"""
from PIL import Image
from collections import deque

PATH = "public/logos/burger-king.png"

img = Image.open(PATH).convert("RGBA")
w, h = img.size
px = img.load()


def is_beige(r: int, g: int, b: int, a: int) -> bool:
    """True, если пиксель считается «бежевым фоном» — его можно залить."""
    if a < 50:
        # Уже почти прозрачный — считаем заливаемым, чтобы расширять
        # прозрачные углы внутрь.
        return True
    # Бежевый: светлый, без сильного оранжевого/красного оттенка.
    # Оранжевая булочка ~ (255,135,50): R-G ≈ 120, R-B ≈ 205  → отбрасываем.
    # Бежевый фон     ~ (245,235,220): R-G ≈ 10, G-B ≈ 15   → берём.
    if not (r > 215 and g > 195 and b > 170):
        return False
    if (r - g) > 35:   # слишком оранжевый/красный
        return False
    if (g - b) > 60:   # слишком жёлтый
        return False
    return True


# Flood-fill (4-связность, без повторов) от 4 углов.
visited = bytearray(w * h)  # 0/1 — посещён
queue: deque[tuple[int, int]] = deque()
for start in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    queue.append(start)

filled = 0
while queue:
    x, y = queue.popleft()
    if x < 0 or x >= w or y < 0 or y >= h:
        continue
    idx = y * w + x
    if visited[idx]:
        continue
    r, g, b, a = px[x, y]
    if not is_beige(r, g, b, a):
        continue
    visited[idx] = 1
    px[x, y] = (0, 0, 0, 0)  # прозрачный
    filled += 1
    queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

print(f"Залито (удалено) пикселей: {filled} из {w * h} ({filled / (w * h) * 100:.1f}%)")

# Дополнительно: «дотёр» одиночные полупрозрачные/бежевые «ворсинки» по краям
# бургера — это антиалиасинг между оранжевым и бежевым фоном, без него край
# будет выглядеть грязновато.
cleanup = 0
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        # Полупрозрачные светлые пиксели по периметру — сглаживаем в прозрачность.
        if a < 220 and r > 220 and g > 200 and b > 170 and (r - g) < 30:
            px[x, y] = (0, 0, 0, 0)
            cleanup += 1
print(f"Дотёрто антиалиасинг-ворсинок: {cleanup}")

# Сохраняем (с оптимизацией альфа-канала).
img.save(PATH, optimize=True)
print(f"Готово: {PATH}")
