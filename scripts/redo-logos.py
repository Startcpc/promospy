#!/usr/bin/env python3
"""
Перекачивает логотипы для брендов, у которых сейчас фото вместо логотипа.
Использует z-ai image-search с уточнёнными запросами на "logo png transparent".
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

LOGOS_DIR = Path("/home/z/my-project/public/logos")

# slug -> поисковый запрос (фокус на логотип, не на фото)
REDO = {
    "pepsico": "PepsiCo corporate logo png transparent",
    "kfc": "KFC logo png transparent vector",
    "subway": "Subway restaurant logo png transparent",
    "dominos": "Domino's Pizza logo png transparent vector",
    "dunkin": "Dunkin Donuts logo png transparent",
    "nescafe": "Nescafe logo png transparent red",
    "mms": "M&M's logo png transparent",
    "snickers": "Snickers chocolate bar logo png transparent",
    "mars": "Mars chocolate bar logo png transparent",
    "ferrero": "Ferrero logo png transparent",
    "nutella": "Nutella logo png transparent",
    "toblerone": "Toblerone logo png transparent",
    "lindt": "Lindt chocolate logo png transparent",
    "haribo": "Haribo logo png transparent",
    "heinz": "Heinz ketchup logo png transparent",
    "hellmanns": "Hellmann's mayonnaise logo png transparent",
    "kelloggs": "Kellogg's logo png transparent",
    "dole": "Dole food company logo png transparent",
    "mondelez": "Mondelez International logo png transparent",
    "kraft-heinz": "Kraft Heinz company logo png transparent",
    "baskin-robbins": "Baskin Robbins logo png transparent",
    "ben-and-jerrys": "Ben and Jerry's logo png transparent",
    "cheerios": "Cheerios cereal logo png transparent",
    "sprite": "Sprite soda logo png transparent green",
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

def search_image(query, count=8):
    tmp = "/tmp/_imgsearch_redo.json"
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

def process():
    ok = 0
    fail = 0
    for slug, query in REDO.items():
        print(f"\n[{slug}] query: {query}")
        urls = search_image(query, count=8)
        if not urls:
            print(f"  no results")
            fail += 1
            continue

        success = False
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
            print(f"  try {i+1}/{len(urls)}: {url[:80]}")
            if http_download(url, dest):
                sz = dest.stat().st_size
                if sz > 1_500_000:
                    print(f"    too big ({sz}b), skip")
                    dest.unlink()
                    continue
                print(f"OK   {slug} -> {dest.name} ({sz}b)")
                ok += 1
                success = True
                # Удалим старые файлы с другим расширением
                for old_ext in (".png", ".jpg", ".jpeg", ".webp"):
                    if old_ext != ext:
                        old = LOGOS_DIR / f"{slug}{old_ext}"
                        if old.exists():
                            old.unlink()
                break
            else:
                if dest.exists():
                    dest.unlink()

        if not success:
            print(f"FAIL {slug}")
            fail += 1

        time.sleep(0.5)

    print(f"\n=== Summary ===")
    print(f"Replaced: {ok}")
    print(f"Failed:  {fail}")
    print(f"Total files: {len(list(LOGOS_DIR.iterdir()))}")

if __name__ == "__main__":
    process()
