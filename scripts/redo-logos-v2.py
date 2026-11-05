#!/usr/bin/env python3
"""
Перекачивает 9 проблемных логотипов через z-ai image-search с уточнёнными
запросами (фокус на SVG/wordmark, не на фото продуктов).
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

LOGOS_DIR = Path("/home/z/my-project/public/logos")

# slug -> список запросов (пробуем по очереди)
REDO = {
    "coca-cola": [
        "Coca-Cola wordmark logo svg",
        "Coca-Cola red logo white background",
        "Coca-Cola company logo vector",
    ],
    "dominos": [
        "Domino's Pizza red blue logo svg",
        "Dominos company logo vector",
        "Dominos Pizza wordmark logo",
    ],
    "monster-energy": [
        "Monster Energy drink logo svg green",
        "Monster Energy claw logo vector",
        "Monster Energy wordmark black green",
    ],
    "doritos": [
        "Doritos logo svg red triangle",
        "Doritos brand wordmark logo",
        "Doritos chips logo vector",
    ],
    "oreo": [
        "Oreo logo svg blue white",
        "Oreo brand wordmark logo",
        "Oreo cookies logo vector",
    ],
    "mms": [
        "M&M's logo svg white background",
        "M&M's brand wordmark logo",
        "M&M chocolate logo vector",
    ],
    "mars": [
        "Mars bar logo svg black red",
        "Mars chocolate wordmark logo",
        "Mars brand logo vector",
    ],
    "hellmanns": [
        "Hellmann's mayonnaise logo svg blue",
        "Hellmann's brand wordmark logo",
        "Hellmanns logo vector",
    ],
    "kraft-heinz": [
        "Kraft Heinz company logo svg",
        "Kraft Heinz corporate logo vector",
        "Kraft Heinz wordmark logo",
    ],
}

UA = "FoodCatalogBot/1.0"
TIMEOUT = 30

def http_download(url, dest):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = r.read()
        if len(data) < 2000:
            return False
        dest.write_bytes(data)
        return True
    except Exception as e:
        print(f"  download error: {e}", file=sys.stderr)
        return False

def search_image(query, count=10):
    tmp = "/tmp/_imgsearch_redo2.json"
    try:
        subprocess.run(
            ["z-ai", "image-search", "-q", query, "-c", str(count), "--no-rank", "--gl", "us", "-o", tmp],
            check=True, capture_output=True, timeout=180,
        )
        with open(tmp) as f:
            data = json.load(f)
        if data.get("success") and data.get("results"):
            return [r["original_url"] for r in data["results"]]
    except Exception as e:
        print(f"  search error: {e}", file=sys.stderr)
    return []

def is_image_file(path):
    """Проверяет, что файл — валидное изображение (не SVG с неправильным расширением)."""
    import subprocess
    r = subprocess.run(["file", "-b", "--mime-type", str(path)], capture_output=True, text=True)
    mime = r.stdout.strip()
    return mime.startswith("image/") and "svg" not in mime

def process():
    ok = 0
    fail = 0
    for slug, queries in REDO.items():
        print(f"\n[{slug}]")
        success = False
        for query in queries:
            print(f"  query: {query}")
            urls = search_image(query, count=10)
            if not urls:
                continue

            for i, url in enumerate(urls):
                lower = url.lower().split("?")[0]
                if ".png" in lower:
                    ext = ".png"
                elif ".jpg" in lower or ".jpeg" in lower:
                    ext = ".jpg"
                elif ".webp" in lower:
                    ext = ".webp"
                else:
                    ext = ".png"

                dest = LOGOS_DIR / f"{slug}{ext}"
                print(f"    try {i+1}: {url[:80]}")
                if http_download(url, dest):
                    sz = dest.stat().st_size
                    if sz > 1_500_000:
                        print(f"      too big ({sz}b), skip")
                        dest.unlink()
                        continue
                    if not is_image_file(dest):
                        # SVG с неправильным расширением — конвертируем
                        import subprocess as sp
                        svg_path = dest.with_suffix(".svg")
                        dest.rename(svg_path)
                        try:
                            import cairosvg
                            cairosvg.svg2png(url=str(svg_path), write_to=str(dest), output_width=512, output_height=512)
                            svg_path.unlink()
                            print(f"      converted SVG -> PNG")
                        except Exception as e:
                            print(f"      SVG conversion failed: {e}")
                            svg_path.unlink()
                            if dest.exists():
                                dest.unlink()
                            continue
                    print(f"OK   {slug} -> {dest.name} ({sz}b)")
                    ok += 1
                    success = True
                    # Удалим старые с другим расширением
                    for old_ext in (".png", ".jpg", ".jpeg", ".webp"):
                        if old_ext != ext:
                            old = LOGOS_DIR / f"{slug}{old_ext}"
                            if old.exists():
                                old.unlink()
                    break
                else:
                    if dest.exists():
                        dest.unlink()
            if success:
                break
            time.sleep(0.5)

        if not success:
            print(f"FAIL {slug}")
            fail += 1

    print(f"\n=== Summary ===")
    print(f"Replaced: {ok}")
    print(f"Failed:  {fail}")

if __name__ == "__main__":
    process()
