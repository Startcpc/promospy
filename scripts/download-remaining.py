#!/usr/bin/env python3
"""Докачивает оставшиеся логотипы через z-ai image-search CLI."""
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

LOGOS_DIR = Path("/home/z/my-project/public/logos")

REMAINING = {
    "dominos": "Domino's Pizza logo official",
    "sprite": "Sprite soda logo official Coca-Cola",
    "doritos": "Doritos tortilla chips logo official",
    "mars": "Mars chocolate bar logo official",
    "hellmanns": "Hellmann's mayonnaise logo official",
    "danone": "Danone company logo official",
    "dole": "Dole fruit company logo official",
    "tropicana": "Tropicana orange juice logo official",
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

def search_image(query):
    """Вызывает z-ai image-search и возвращает первый URL."""
    tmp = "/tmp/_imgsearch.json"
    try:
        subprocess.run(
            ["z-ai", "image-search", "-q", query, "-c", "5", "--no-rank", "--gl", "us", "-o", tmp],
            check=True, capture_output=True, timeout=120,
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
    for slug, query in REMAINING.items():
        # Проверим, нет ли уже файла
        existing = None
        for ext in (".png", ".jpg", ".jpeg"):
            p = LOGOS_DIR / f"{slug}{ext}"
            if p.exists() and p.stat().st_size > 3000:
                existing = p
                break
        if existing:
            print(f"SKIP {slug}")
            continue

        print(f"[{slug}] query: {query}")
        urls = search_image(query)
        if not urls:
            print(f"  no results")
            fail += 1
            continue

        success = False
        for i, url in enumerate(urls):
            # Определим расширение
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
                break
            else:
                if dest.exists():
                    dest.unlink()

        if not success:
            print(f"FAIL {slug}")
            fail += 1

        time.sleep(1)

    print(f"\n=== Summary ===")
    print(f"Downloaded: {ok}")
    print(f"Failed: {fail}")
    print(f"Total files: {len(list(LOGOS_DIR.iterdir()))}")

if __name__ == "__main__":
    process()
