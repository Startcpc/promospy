#!/usr/bin/env python3
"""
Перекачивает логотипы для брендов, у которых сейчас фото вместо логотипа.
Использует Wikipedia Commons API для поиска файлов с "logo" в названии.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

LOGOS_DIR = Path("/home/z/my-project/public/logos")

# slug -> поисковые запросы для Commons API
REDO = {
    "coca-cola": ["Coca-Cola logo", "Coca-Cola wordmark"],
    "dominos": ["Domino's Pizza logo", "Dominos logo"],
    "monster-energy": ["Monster Energy logo", "Monster logo"],
    "doritos": ["Doritos logo", "Doritos brand logo"],
    "oreo": ["Oreo logo", "Oreo brand logo"],
    "mms": ["M&M's logo", "M&M logo", "Mms logo"],
    "mars": ["Mars bar logo", "Mars chocolate logo"],
    "hellmanns": ["Hellmann's logo", "Hellmanns logo"],
    "kraft-heinz": ["Kraft Heinz logo", "Kraft Heinz company logo"],
}

UA = "FoodCatalogBot/1.0 (educational project)"
TIMEOUT = 25

def http_get(url, binary=False, retry=True):
    last_err = None
    for attempt in range(4):
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

def search_commons(query):
    """Ищет файлы на Wikimedia commons с данным запросом."""
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "srnamespace": "6",  # File namespace
        "format": "json",
        "srlimit": "10",
        "formatversion": "2",
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    try:
        data = json.loads(http_get(url))
        results = []
        for item in data.get("query", {}).get("search", []):
            title = item.get("title", "")  # "File:Xxx.svg"
            if title.startswith("File:"):
                filename = title[5:]
                # Фильтруем: только изображения, не видео/аудио
                lower = filename.lower()
                if any(lower.endswith(ext) for ext in [".svg", ".png", ".jpg", ".jpeg"]):
                    results.append(filename)
        return results
    except Exception as e:
        print(f"  search error: {e}", file=sys.stderr)
        return []

def get_file_url(filename):
    """Получает прямой URL файла через Commons API."""
    params = {
        "action": "query",
        "titles": f"File:{filename}",
        "prop": "imageinfo",
        "iiprop": "url|size|mime",
        "format": "json",
        "formatversion": "2",
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    try:
        data = json.loads(http_get(url))
        pages = data.get("query", {}).get("pages", [])
        if pages:
            ii = pages[0].get("imageinfo", [])
            if ii:
                return {
                    "url": ii[0].get("url"),
                    "mime": ii[0].get("mime", ""),
                    "width": ii[0].get("width", 0),
                    "height": ii[0].get("height", 0),
                }
    except Exception as e:
        print(f"  fileinfo error: {e}", file=sys.stderr)
    return None

def download(url, dest):
    try:
        data = http_get(url, binary=True)
        if len(data) < 2000:
            return False
        dest.write_bytes(data)
        return True
    except Exception as e:
        print(f"  download error: {e}", file=sys.stderr)
        return False

def process():
    ok = 0
    fail = 0
    for slug, queries in REDO.items():
        print(f"\n[{slug}]")
        success = False
        for query in queries:
            print(f"  searching: {query}")
            time.sleep(2)
            files = search_commons(query)
            if not files:
                continue
            print(f"  found {len(files)} files: {files[:3]}")
            for filename in files[:5]:  # пробуем первые 5 файлов
                time.sleep(1)
                info = get_file_url(filename)
                if not info or not info.get("url"):
                    continue
                # Пропускаем слишком большие (вероятно фото)
                if info.get("width", 0) > 0 and info["width"] > 2000:
                    print(f"    skip {filename} (too wide: {info['width']}px)")
                    continue
                if info.get("mime") not in ("image/svg+xml", "image/png", "image/jpeg"):
                    continue

                # Определяем расширение
                lower = filename.lower()
                if ".svg" in lower:
                    ext = ".png"
                    # Для SVG используем thumb-генератор Wikimedia
                    file_no_prefix = filename
                    encoded = urllib.parse.quote(file_no_prefix, safe="")
                    download_url = f"https://upload.wikimedia.org/wikipedia/commons/thumb/{file_no_prefix[0:1]}/{file_no_prefix[1:2]}/{file_no_prefix}/512px-{file_no_prefix}.png"
                    # Упрощаем: используем Special:FilePath для SVG -> PNG
                    download_url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{encoded}?width=512"
                else:
                    ext = ".png" if ".png" in lower else ".jpg"
                    download_url = info["url"]

                dest = LOGOS_DIR / f"{slug}{ext}"
                print(f"    trying: {filename[:60]} -> {dest.name}")
                if download(download_url, dest):
                    sz = dest.stat().st_size
                    if sz > 1_500_000:
                        print(f"    too big ({sz}b), skip")
                        dest.unlink()
                        continue
                    print(f"OK   {slug} -> {dest.name} ({sz}b)")
                    ok += 1
                    success = True
                    # Удалим старые с другим расширением
                    for old_ext in (".png", ".jpg", ".jpeg"):
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

        if not success:
            print(f"FAIL {slug}")
            fail += 1

    print(f"\n=== Summary ===")
    print(f"Replaced: {ok}")
    print(f"Failed:  {fail}")
    print(f"Total files: {len(list(LOGOS_DIR.iterdir()))}")

if __name__ == "__main__":
    process()
