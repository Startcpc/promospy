#!/usr/bin/env python3
"""
Пересохраняет логотипы в топ-качестве:
- 768px по большей стороне (вместо 512px)
- Без агрессивного сжатия (optimize=True, но без понижения качества)
- Сохраняет прозрачность
"""
import os
from pathlib import Path
from PIL import Image

LOGOS_DIR = Path("/home/z/my-project/public/logos")
MAX_SIZE = 768

# Только логотипы, которые сейчас используются (из companies.ts)
import re
content = (Path("/home/z/my-project/src/lib/companies.ts")).read_text(encoding="utf-8")
used_logos = re.findall(r'logo:\s*"([^"]+)"', content)
used_files = [Path("/home/z/my-project/public" + l).name for l in used_logos]
print(f"Used logos: {used_files}")

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
        if max(w, h) > MAX_SIZE:
            ratio = MAX_SIZE / max(w, h)
            new_size = (max(1, int(w * ratio)), max(1, int(h * ratio)))
            img = img.resize(new_size, Image.LANCZOS)
        
        # Сохраняем с максимальным качеством
        img.save(src, "PNG", optimize=False, compress_level=1)
        sz = src.stat().st_size
        print(f"OK   {f}: {img.size}, {sz}b")
        ok += 1
    except Exception as e:
        print(f"FAIL {f}: {e}")

print(f"\nDone: {ok} logos re-saved at top quality")
