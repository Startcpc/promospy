#!/usr/bin/env python3
"""Финальная перекачка для 3 проблемных брендов: Doritos, Oreo, Heinz."""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

LOGOS_DIR = Path("/home/z/my-project/public/logos")

REDO = {
    "doritos": [
        "Doritos logo png transparent",
        "Doritos brand logo vector eps",
        "Doritos chips company logo",
        "Doritos wordmark typography logo",
    ],
    "oreo": [
        "Oreo cookies company logo png",
        "Oreo brand logo vector eps",
        "Oreo wordmark blue logo",
        "Oreo sandwich cookies logo",
    ],
    "heinz": [
        "Heinz tomato ketchup logo png",
        "Heinz brand logo vector",
        "Heinz company wordmark logo",
        "Heinz logo red white",
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
    tmp = "/tmp/_imgsearch_final.json"
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
    r = subprocess.run(["file", "-b", "--mime-type", str(path)], capture_output=True, text=True)
    mime = r.stdout.strip()
    return mime.startswith("image/") and "svg" not in mime

def process():
    for slug, queries in REDO.items():
        print(f"\n[{slug}]")
        # удалим старый файл
        for ext in (".png", ".jpg", ".jpeg"):
            old = LOGOS_DIR / f"{slug}{ext}"
            if old.exists():
                old.unlink()

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
                    if sz > 800_000:
                        print(f"      too big ({sz}b), skip")
                        dest.unlink()
                        continue
                    if not is_image_file(dest):
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
                    success = True
                    break
                else:
                    if dest.exists():
                        dest.unlink()
            if success:
                break
            time.sleep(0.5)

        if not success:
            print(f"FAIL {slug}")

if __name__ == "__main__":
    process()
