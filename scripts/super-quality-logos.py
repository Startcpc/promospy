#!/usr/bin/env python3
"""
Пересохраняет логотипы в СУПЕРПУПЕР качестве:
- 1536px по большей стороне (вместо 768px)
- Максимальное качество PNG (compress_level=0 — без сжатия)
- Сохраняет прозрачность
"""
import os
import re
from pathlib import Path
from PIL import Image

LOGOS_DIR = Path("/home/z/my-project/public/logos")
MAX_SIZE = 1536

content = (Path("/home/z/my-project/src/lib/companies.ts")).read_text(encoding="utf-8")
used_logos = re.findall(r'logo:\s*"([^"]+)"', content)
used_files = [Path("/home/z/my-project/public" + l).name for l in used_logos]
print(f"Used logos: {len(used_files)}")

ok = 0
for f in sorted(os.listdir(LOGOS_DIR)):
    if f not in used_files:
        continue
    src = LOGOS_DIR / f
    if not src.is_file():
        continue

    try:
        img = Image.open(src).convert("RGBA")
        w, h = img.size
        original_size = (w, h)

        # Если изображение меньше MAX_SIZE — НЕ увеличиваем (избегаем пикселей)
        # Если больше — уменьшаем до MAX_SIZE с LANCZOS (лучший алгоритм)
        if max(w, h) > MAX_SIZE:
            ratio = MAX_SIZE / max(w, h)
            new_size = (max(1, int(w * ratio)), max(1, int(h * ratio)))
            img = img.resize(new_size, Image.LANCZOS)

        # Сохраняем с максимальным качеством (compress_level=0 = без потерь)
        img.save(src, "PNG", optimize=False, compress_level=0)
        sz = src.stat().st_size
        print(f"OK   {f}: {original_size} -> {img.size}, {sz}b")
        ok += 1
    except Exception as e:
        print(f"FAIL {f}: {e}")

print(f"\nDone: {ok} logos at SUPER quality")
