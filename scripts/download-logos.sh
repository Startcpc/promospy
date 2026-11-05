#!/usr/bin/env bash
# Скачиваем официальные логотипы с Wikimedia Commons (свободно распространяемые)
set -uo pipefail
cd /home/z/my-project/public/logos

declare -A URLS=(
  ["coca-cola"]="https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Coca-Cola_logo.svg/512px-Coca-Cola_logo.svg.png"
  ["pepsico"]="https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Pepsi_2023.svg/512px-Pepsi_2023.svg.png"
  ["nestle"]="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Nestl%C3%A9_logo_2015.svg/512px-Nestl%C3%A9_logo_2015.svg.png"
  ["mcdonalds"]="https://upload.wikimedia.org/wikipedia/commons/thumb/3/ra/McDonald%27s_Golden_Arches.svg/512px-McDonald%27s_Golden_Arches.svg.png"
  ["burger-king"]="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Burger_King_2020.svg/512px-Burger_King_2020.svg.png"
  ["kfc"]="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/KFC_logo.svg/512px-KFC_logo.svg.png"
  ["starbucks"]="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Starbucks_Corporation_Logo_2011.svg/512px-Starbucks_Corporation_Logo_2011.svg.png"
  ["subway"]="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Subway_2016_logo.svg/512px-Subway_2016_logo.svg.png"
  ["dominos"]="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Domino%27s_pizza_logo.svg/512px-Domino%27s_pizza_logo.svg.png"
  ["pizza-hut"]="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Pizza_Hut_logo.svg/512px-Pizza_Hut_logo.svg.png"
  ["dunkin"]="https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Dunkin%27_Logo.svg/512px-Dunkin%27_Logo.svg.png"
  ["wendys"]="https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Wendy%27s_logo_2012.svg/512px-Wendy%27s_logo_2012.svg.png"
  ["red-bull"]="https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Red_Bull_Logo.svg/512px-Red_Bull_Logo.svg.png"
  ["monster-energy"]="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Monster_Energy_Logo.svg/512px-Monster_Energy_Logo.svg.png"
  ["fanta"]="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Fanta_logo_2025.svg/512px-Fanta_logo_2025.svg.png"
  ["sprite"]="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Sprite-Logo.svg/512px-Sprite-Logo.svg.png"
  ["dr-pepper"]="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Dr_Pepper_logo_2017.svg/512px-Dr_Pepper_logo_2017.svg.png"
  ["nescafe"]="https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Nescaf%C3%A9_logo.svg/512px-Nescaf%C3%A9_logo.svg.png"
  ["nespresso"]="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Nespresso_logo.svg/512px-Nespresso_logo.svg.png"
  ["lays"]="https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Lay%27s_logo.svg/512px-Lay%27s_logo.svg.png"
  ["doritos"]="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Doritos_logo.svg/512px-Doritos_logo.svg.png"
  ["pringles"]="https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Pringles_logo.svg/512px-Pringles_logo.svg.png"
  ["oreo"]="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Oreo_logo.svg/512px-Oreo_logo.svg.png"
  ["kitkat"]="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/KitKat_logo.svg/512px-KitKat_logo.svg.png"
  ["mms"]="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/M%26M%27s_logo.svg/512px-M%26M%27s_logo.svg.png"
  ["snickers"]="https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Snickers_logo.svg/512px-Snickers_logo.svg.png"
  ["mars"]="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Mars_logo.svg/512px-Mars_logo.svg.png"
  ["ferrero"]="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Ferrero-logo.svg/512px-Ferrero-logo.svg.png"
  ["nutella"]="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Nutella_logo.svg/512px-Nutella_logo.svg.png"
  ["toblerone"]="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Toblerone_logo.svg/512px-Toblerone_logo.svg.png"
  ["lindt"]="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Lindt_Logo.svg/512px-Lindt_Logo.svg.png"
  ["haribo"]="https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/HARIBO_Logo.svg/512px-HARIBO_Logo.svg.png"
  ["cadbury"]="https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Cadbury_logo.svg/512px-Cadbury_logo.svg.png"
  ["heinz"]="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Heinz_logo.svg/512px-Heinz_logo.svg.png"
  ["hellmanns"]="https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Hellmann%27s_logo.svg/512px-Hellmann%27s_logo.svg.png"
  ["knorr"]="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Knorr_logo.svg/512px-Knorr_logo.svg.png"
  ["kelloggs"]="https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Kellogg%27s_logo.svg/512px-Kellogg%27s_logo.svg.png"
  ["danone"]="https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Danone_logo.svg/512px-Danone_logo.svg.png"
  ["chiquita"]="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Chiquita_logo.svg/512px-Chiquita_logo.svg.png"
  ["dole"]="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Dole_logo.svg/512px-Dole_logo.svg.png"
  ["tropicana"]="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Tropicana_logo.svg/512px-Tropicana_logo.svg.png"
  ["mondelez"]="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Mondelez_International_logo.svg/512px-Mondelez_International_logo.svg.png"
  ["unilever"]="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Unilever_logo.svg/512px-Unilever_logo.svg.png"
  ["general-mills"]="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/General_Mills_logo.svg/512px-General_Mills_logo.svg.png"
  ["kraft-heinz"]="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Kraft_Heinz_Company_logo.svg/512px-Kraft_Heinz_Company_logo.svg.png"
  ["baskin-robbins"]="https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Baskin-Robbins_logo.svg/512px-Baskin-Robbins_logo.svg.png"
  ["ben-and-jerrys"]="https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Ben_%26_Jerry%27s_logo.svg/512px-Ben_%26_Jerry%27s_logo.svg.png"
  ["haagen-dazs"]="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/H%C3%A4agen-Dazs_logo.svg/512px-H%C3%A4agen-Dazs_logo.svg.png"
  ["milka"]="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Milka_logo.svg/512px-Milka_logo.svg.png"
  ["cheerios"]="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Cheerios_logo.svg/512px-Cheerios_logo.svg.png"
)

ok=0
fail=0
for name in "${!URLS[@]}"; do
  url="${URLS[$name]}"
  out="${name}.png"
  if curl -fsSL -A "Mozilla/5.0 (X11; Linux x86_64) Research/1.0" --max-time 15 -o "$out" "$url" 2>/dev/null; then
    sz=$(stat -c%s "$out" 2>/dev/null || echo 0)
    if [ "$sz" -gt 1000 ]; then
      echo "OK   $name (${sz} bytes)"
      ok=$((ok+1))
    else
      rm -f "$out"
      echo "FAIL $name (too small)"
      fail=$((fail+1))
    fi
  else
    rm -f "$out"
    echo "FAIL $name (curl error)"
    fail=$((fail+1))
  fi
done

echo "---"
echo "Downloaded: $ok, Failed: $fail"
echo "Total files in logos/:"
ls -1 /home/z/my-project/public/logos/ | wc -l
