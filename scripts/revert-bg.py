#!/usr/bin/env python3
"""
Откатывает bgColor к значениям из версии ДО последнего фикса,
КРОМЕ Ozon — у него оставляем голубой #EAF1FF.
"""
import re
from pathlib import Path

# Старые значения bg (до последнего фикса) — Ozon оставляем голубым
OLD_BG = {
    "burger-king":        "FFF1F1",  # было
    "vkusvill-user":      "2DBD65",  # не менялось
    "vkusno-i-tochka":    "0B6E4F",  # вернуть зелёный брендовый
    "magnit-user":        "FFFFFF",  # вернуть белый
    "pyaterochka-user":   "008F33",  # не менялось
    "yandex-lavka-user":  "01ADFF",  # почти то же
    "yandex-market-user": "FFFFFF",  # не менялось
    "perekryostok-user":  "FFFFFF",  # вернуть белый
    "lenta":              "F5F5F5",  # вернуть серый
    "wildberries":        "F8F0FA",  # было
    "ozon-user":          "EAF1FF",  # ГОЛУБОЙ — оставить (особое требование)
    "tanuki-user":        "FE0000",  # не менялось
}

path = Path("/home/z/my-project/src/lib/companies.ts")
content = path.read_text(encoding="utf-8")

def update_block(match):
    block = match.group(0)
    logo_m = re.search(r'logo:\s*"/logos/([^/.]+)\.', block)
    if not logo_m:
        return block
    slug = logo_m.group(1)
    new_bg = OLD_BG.get(slug)
    if not new_bg:
        return block
    block = re.sub(
        r'(bgColor:\s*")[A-Fa-f0-9]+(")',
        f'\\g<1>{new_bg}\\g<2>',
        block,
    )
    return block

new_content = re.sub(
    r'\{\s*id:\s*\d+,.*?\n  \}',
    update_block,
    content,
    flags=re.DOTALL,
)

path.write_text(new_content, encoding="utf-8")

# Проверка
verify = path.read_text(encoding="utf-8")
print("Откатанные bgColor:")
for m in re.finditer(r'logo:\s*"/logos/([^/.]+)\.[^"]+".*?bgColor:\s*"([A-Fa-f0-9]+)"', verify, re.DOTALL):
    slug = m.group(1)
    bg = m.group(2)
    expected = OLD_BG.get(slug, "?")
    mark = "✓" if bg == expected else "✗"
    note = " ← голубой (оставлен)" if slug == "ozon-user" else ""
    print(f"  {mark} {slug}: #{bg}{note}")
