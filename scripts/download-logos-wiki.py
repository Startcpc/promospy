#!/usr/bin/env python3
"""
Скачивает официальные логотипы через MediaWiki API (prop=pageimages).
Этот API возвращает именно главное изображение статьи (обычно логотип/infobox image).
Добавлены: задержка между запросами, retry на 429, фильтр по размеру.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

LOGOS_DIR = Path("/home/z/my-project/public/logos")
LOGOS_DIR.mkdir(parents=True, exist_ok=True)

BRANDS = {
    "coca-cola": ["Coca-Cola"],
    "pepsico": ["PepsiCo"],
    "nestle": ["Nestlé"],
    "mcdonalds": ["McDonald's"],
    "burger-king": ["Burger King"],
    "kfc": ["KFC"],
    "starbucks": ["Starbucks"],
    "subway": ["Subway (restaurant)", "Subway"],
    "dominos": ["Domino's Pizza"],
    "pizza-hut": ["Pizza Hut"],
    "dunkin": ["Dunkin' Donuts", "Dunkin'"],
    "wendys": ["Wendy's"],
    "red-bull": ["Red Bull"],
    "monster-energy": ["Monster Energy"],
    "fanta": ["Fanta"],
    "sprite": ["Sprite"],
    "dr-pepper": ["Dr Pepper"],
    "nescafe": ["Nescafé"],
    "nespresso": ["Nespresso"],
    "lays": ["Lay's"],
    "doritos": ["Doritos"],
    "pringles": ["Pringles"],
    "oreo": ["Oreo"],
    "kitkat": ["Kit Kat", "KitKat"],
    "mms": ["M&M's"],
    "snickers": ["Snickers"],
    "mars": ["Mars bar"],
    "ferrero": ["Ferrero SpA", "Ferrero"],
    "nutella": ["Nutella"],
    "toblerone": ["Toblerone"],
    "lindt": ["Lindt & Sprüngli", "Lindt"],
    "haribo": ["Haribo"],
    "cadbury": ["Cadbury"],
    "heinz": ["H. J. Heinz Company", "Heinz"],
    "hellmanns": ["Hellmann's"],
    "knorr": ["Knorr (brand)", "Knorr"],
    "kelloggs": ["Kellogg's"],
    "danone": ["Danone"],
    "chiquita": ["Chiquita Brands International", "Chiquita"],
    "dole": ["Dole Food Company", "Dole"],
    "tropicana": ["Tropicana Products", "Tropicana"],
    "mondelez": ["Mondelez International"],
    "unilever": ["Unilever"],
    "general-mills": ["General Mills"],
    "kraft-heinz": ["Kraft Heinz", "Kraft Foods"],
    "baskin-robbins": ["Baskin-Robbins"],
    "ben-and-jerrys": ["Ben & Jerry's"],
    "haagen-dazs": ["Häagen-Dazs", "Haagen-Dazs"],
    "milka": ["Milka"],
    "cheerios": ["Cheerios"],
}

UA = "FoodCatalogBot/1.0 (educational project; contact@example.com)"
TIMEOUT = 25
MAX_RETRIES = 4
DELAY_BETWEEN_REQUESTS = 2.5  # секунд

def http_get(url, binary=False, retry=True):
    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return r.read() if binary else r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429:
                wait = 8 * (attempt + 1)
                print(f"    429, waiting {wait}s...", file=sys.stderr)
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            last_err = e
            time.sleep(2)
    raise last_err or RuntimeError("max retries")

def get_wiki_image_url(article_title):
    """Получает URL изображения статьи через MediaWiki API (pageimages)."""
    params = {
        "action": "query",
        "titles": article_title,
        "prop": "pageimages",
        "format": "json",
        "pithumbsize": "512",
        "pilicense": "any",
        "formatversion": "2",
    }
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    try:
        data = json.loads(http_get(url))
        pages = data.get("query", {}).get("pages", [])
        if pages:
            thumb = pages[0].get("thumbnail", {})
            if thumb.get("source"):
                return thumb["source"]
            # Иногда pageimages не возвращает thumbnail, попробуем original
            orig = pages[0].get("original", {})
            if orig.get("source"):
                return orig["source"]
    except Exception as e:
        print(f"  API error for '{article_title}': {e}", file=sys.stderr)
    return None

def download(url, dest_path):
    try:
        data = http_get(url, binary=True)
        if len(data) < 2000:
            return False
        dest_path.write_bytes(data)
        return True
    except Exception as e:
        print(f"  Download error: {e}", file=sys.stderr)
        return False

def process():
    ok = 0
    fail = 0
    failed_brands = []
    for slug, titles in BRANDS.items():
        existing = None
        for ext in (".png", ".jpg", ".jpeg", ".svg"):
            p = LOGOS_DIR / f"{slug}{ext}"
            if p.exists() and p.stat().st_size > 3000:
                existing = p
                break
        if existing:
            print(f"SKIP  {slug}")
            continue

        success = False
        for title in titles:
            print(f"  [{slug}] article: {title}")
            time.sleep(DELAY_BETWEEN_REQUESTS)
            img_url = get_wiki_image_url(title)
            if not img_url:
                print(f"    no image for '{title}'")
                continue

            # Определяем расширение
            lower = img_url.lower()
            if ".svg" in lower:
                ext = ".png"  # уже конвертированный thumbnail
            elif ".png" in lower:
                ext = ".png"
            elif ".jpg" in lower or ".jpeg" in lower:
                ext = ".jpg"
            else:
                ext = ".png"

            dest = LOGOS_DIR / f"{slug}{ext}"
            if download(img_url, dest):
                sz = dest.stat().st_size
                if sz > 1_500_000:
                    # Скорее всего фотография, не логотип — удаляем
                    print(f"    too big ({sz}b), probably photo, skip")
                    dest.unlink()
                    continue
                print(f"OK    {slug} -> {dest.name} ({sz}b)")
                ok += 1
                success = True
                break
            else:
                if dest.exists():
                    dest.unlink()

        if not success:
            print(f"FAIL  {slug}")
            fail += 1
            failed_brands.append(slug)

    print(f"\n=== Summary ===")
    print(f"Downloaded: {ok}")
    print(f"Failed:     {fail}")
    if failed_brands:
        print(f"Failed brands: {', '.join(failed_brands)}")
    print(f"Files in {LOGOS_DIR}: {len(list(LOGOS_DIR.iterdir()))}")

if __name__ == "__main__":
    process()
