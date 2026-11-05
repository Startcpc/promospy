#!/usr/bin/env python3
"""
Сжимает все логотипы в /public/logos/ до разумного размера (максимум 512px
по большей стороне), конвертирует в RGBA для прозрачности и сохраняет как
PNG (независимо от исходного формата — даёт лучшее качество для логотипов).
"""
import os
from pathlib import Path
from PIL import Image

LOGOS_DIR = Path("/home/z/my-project/public/logos")
MAX_SIZE = 512

ok = 0
fail = 0
converted = []

for f in sorted(os.listdir(LOGOS_DIR)):
    src = LOGOS_DIR / f
    if not src.is_file():
        continue

    try:
        with Image.open(src) as img:
            # Конвертируем в RGBA для поддержки прозрачности
            if img.mode in ("P", "RGB", "L"):
                # Проверяем, есть ли альфа-канал в палитре
                if img.mode == "P":
                    if "transparency" in img.info:
                        img = img.convert("RGBA")
                    else:
                        img = img.convert("RGB").convert("RGBA")
                else:
                    img = img.convert("RGBA")
            elif img.mode == "CMYK":
                img = img.convert("RGB").convert("RGBA")
            # else (RGBA, LA) — оставляем как есть после convert

            # Масштабируем с сохранением пропорций
            w, h = img.size
            if max(w, h) > MAX_SIZE:
                ratio = MAX_SIZE / max(w, h)
                new_size = (max(1, int(w * ratio)), max(1, int(h * ratio)))
                img = img.resize(new_size, Image.LANCZOS)

            # Сохраняем как PNG (новое имя — всегда .png)
            new_name = src.stem + ".png"
            new_path = LOGOS_DIR / new_name

            # Если исходный файл не PNG, удалим старый
            if src.suffix.lower() != ".png":
                src.unlink()

            img.save(new_path, "PNG", optimize=True)

            sz = new_path.stat().st_size
            ok += 1
            if src.suffix.lower() != ".png":
                converted.append(f"{f} -> {new_name} ({img.size[0]}x{img.size[1]}, {sz}b)")
            else:
                converted.append(f"{f} resized ({img.size[0]}x{img.size[1]}, {sz}b)")
    except Exception as e:
        print(f"FAIL {f}: {e}")
        fail += 1

for c in converted:
    print(c)
print(f"\nDone. OK: {ok}, Failed: {fail}")

# Удалим дубликаты (если .png и .jpg одного бренда оба существуют)
seen = set()
to_remove = []
for f in sorted(os.listdir(LOGOS_DIR)):
    stem = Path(f).stem
    if stem in seen:
        to_remove.append(f)
    seen.add(stem)
for f in to_remove:
    (LOGOS_DIR / f).unlink()
    print(f"Removed duplicate: {f}")

print(f"\nFinal files: {len(os.listdir(LOGOS_DIR))}")
total_size = sum((LOGOS_DIR / f).stat().st_size for f in os.listdir(LOGOS_DIR))
print(f"Total size: {total_size / 1024:.1f} KB")
