#!/usr/bin/env bash
# Скачиваем официальные логотипы брендов через z-ai image-search.
# Для каждого бренда ищем 1 изображение и сохраняем в /public/logos/{slug}.png
set -uo pipefail

LOGOS_DIR="/home/z/my-project/public/logos"
mkdir -p "$LOGOS_DIR"
cd "$LOGOS_DIR"

# slug | поисковый запрос
declare -a BRANDS=(
  "coca-cola|Coca-Cola logo official brand"
  "pepsico|Pepsi logo official brand"
  "nestle|Nestle logo official brand"
  "mcdonalds|McDonald's logo golden arches"
  "burger-king|Burger King logo official brand"
  "kfc|KFC logo official brand"
  "starbucks|Starbucks logo siren mermaid"
  "subway|Subway logo official brand"
  "dominos|Domino's Pizza logo official brand"
  "pizza-hut|Pizza Hut logo official brand"
  "dunkin|Dunkin Donuts logo official brand"
  "wendys|Wendy's logo official brand"
  "red-bull|Red Bull logo official brand"
  "monster-energy|Monster Energy logo official brand"
  "fanta|Fanta logo official brand"
  "sprite|Sprite logo official brand"
  "dr-pepper|Dr Pepper logo official brand"
  "nescafe|Nescafe logo official brand"
  "nespresso|Nespresso logo official brand"
  "lays|Lay's potato chips logo"
  "doritos|Doritos logo official brand"
  "pringles|Pringles logo official brand"
  "oreo|Oreo logo official brand"
  "kitkat|KitKat logo official brand"
  "mms|M&M's logo official brand"
  "snickers|Snickers logo official brand"
  "mars|Mars chocolate bar logo"
  "ferrero|Ferrero logo official brand"
  "nutella|Nutella logo jar brand"
  "toblerone|Toblerone chocolate logo mountain"
  "lindt|Lindt chocolate logo official brand"
  "haribo|Haribo gummy bears logo brand"
  "cadbury|Cadbury chocolate logo brand"
  "heinz|Heinz ketchup logo brand"
  "hellmanns|Hellmann's mayonnaise logo brand"
  "knorr|Knorr logo official brand"
  "kelloggs|Kellogg's logo official brand"
  "danone|Danone logo official brand"
  "chiquita|Chiquita banana logo brand"
  "dole|Dole food logo official brand"
  "tropicana|Tropicana orange juice logo"
  "mondelez|Mondelez International logo"
  "unilever|Unilever logo official brand"
  "general-mills|General Mills logo brand"
  "kraft-heinz|Kraft Heinz logo brand"
  "baskin-robbins|Baskin-Robbins ice cream logo"
  "ben-and-jerrys|Ben and Jerry's ice cream logo"
  "haagen-dazs|Haagen-Dazs ice cream logo"
  "milka|Milka chocolate logo purple"
  "cheerios|Cheerios cereal logo brand"
)

ok=0
fail=0

for entry in "${BRANDS[@]}"; do
  slug="${entry%%|*}"
  query="${entry##*|}"
  out="${slug}.png"
  tmp_json="/tmp/imgsearch_${slug}.json"

  # Если уже скачано — пропускаем
  if [ -f "$out" ]; then
    sz=$(stat -c%s "$out" 2>/dev/null || echo 0)
    if [ "$sz" -gt 3000 ]; then
      echo "SKIP $slug (already $sz bytes)"
      ok=$((ok+1))
      continue
    fi
  fi

  # Ищем картинку
  if ! z-ai image-search -q "$query" -c 3 --no-rank --gl us -o "$tmp_json" 2>/dev/null; then
    echo "FAIL $slug (search error)"
    fail=$((fail+1))
    continue
  fi

  # Берём первый URL из результатов
  url=$(python3 -c "
import json,sys
try:
  d=json.load(open('$tmp_json'))
  if d.get('success') and d.get('results'):
    print(d['results'][0]['original_url'])
except Exception as e:
  pass
" 2>/dev/null)

  if [ -z "$url" ]; then
    echo "FAIL $slug (no url)"
    fail=$((fail+1))
    continue
  fi

  # Скачиваем
  if curl -fsSL --max-time 30 -o "$out" "$url" 2>/dev/null; then
    sz=$(stat -c%s "$out" 2>/dev/null || echo 0)
    if [ "$sz" -gt 3000 ]; then
      # Проверим, что это действительно картинка (магические байты)
      mime=$(file -b --mime-type "$out" 2>/dev/null || echo "")
      case "$mime" in
        image/*)
          echo "OK   $slug ($sz bytes, $mime)"
          ok=$((ok+1))
          ;;
        *)
          rm -f "$out"
          echo "FAIL $slug (not image: $mime)"
          fail=$((fail+1))
          ;;
      esac
    else
      rm -f "$out"
      echo "FAIL $slug (too small: $sz)"
      fail=$((fail+1))
    fi
  else
    rm -f "$out"
    echo "FAIL $slug (download error)"
    fail=$((fail+1))
  fi

  rm -f "$tmp_json"
done

echo "---"
echo "Downloaded: $ok, Failed: $fail"
echo "Files in logos/:"
ls -1 "$LOGOS_DIR" | wc -l
