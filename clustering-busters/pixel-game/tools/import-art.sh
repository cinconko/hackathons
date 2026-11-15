#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/media/sprites
PNG=(-strip -define png:compression-level=9 -define png:compression-strategy=1 -define png:compression-filter=5)
command -v magick >/dev/null || { echo "ImageMagick is missing: brew install imagemagick"; exit 1; }

make() {
  local src="art/$1" key="$2" size="$3" mode="$4" w="${3%x*}" h="${3#*x}"
  case "$mode" in
    cut)   magick "$src" -trim +repage -filter Box -resize "${size}!" -channel A -threshold 50% +channel "${PNG[@]}" "$OUT/$key.png" ;;
    bob)   magick "$src" -trim +repage -filter Box -resize "${w}x$((h - 1))!" -channel A -threshold 50% +channel \
             -background none -gravity south -extent "$size" "${PNG[@]}" "$OUT/$key.png" ;;
    tile)  magick "$src" -filter Box -resize "${size}!" "${PNG[@]}" "$OUT/$key.png" ;;
    ttile) magick "$src" -trim +repage -filter Box -resize "${size}!" "${PNG[@]}" "$OUT/$key.png" ;;
    cover) magick "$src" -filter Box -resize "${size}^" -gravity center -extent "$size" "${PNG[@]}" "$OUT/$key.png" ;;
  esac
  echo "  $key  $size  <- $1"
}

echo "art/ -> $OUT"
make Tree.png                 tree            20x21   cut
make Tree_v02_apple.png       tree_apple      20x21   cut
make Bush_Big_Ver02.png       bush_big        19x11   cut
make Bush_Big_Berry_Ver02.png bush_big_berry  19x11   cut
make Bush_Mid_Ver02.png       bush_mid        23x10   cut
make Bush_Mid_Berry_Ver02.png bush_mid_berry  23x10   cut
make Puff.png             cloud           24x19   cut
make Grass.png            grass           32x32   tile
make Water_LilyPad.avif   water           37x37   tile
make WoodenFloor.jpg      floor_wood      64x36   tile
make WoodenWall.png       wall_wood       30x20   tile
make Path_1.png           path_dirt       32x32   ttile
make Path_2.png           path_cobble     40x40   ttile
make Path_3.png           path_brick      40x40   ttile
make Sky03.avif           sky             312x172 cover

make Merchant/Merchant_Green.png              merchant_0  16x18 cut
make Merchant/Merchant_Green.png              merchant_1  16x18 bob
make Merchant/Blanket/March_Blanket_Original.png blanket  36x18 cut
make Merchant/Blanket/March_Blanket_Original.png rug      249x168 cut
for c in DarkBlue Gray Green Orange Red Special; do
  k=$(echo "$c" | tr '[:upper:]' '[:lower:]')
  make "Merchant/Merchant_$c.png"              "merchant_${k}_0" 16x18 cut
  make "Merchant/Merchant_$c.png"              "merchant_${k}_1" 16x18 bob
  make "Merchant/Blanket/March_Blanket_$c.png" "blanket_$k"      36x18 cut
  make "Merchant/Blanket/March_Blanket_$c.png" "rug_$k"          249x168 cut
done

for m in copper bronze iron steel magnetite; do make "Armor/$m.png" "hero_$m" 12x16 cut; done
make Hero/farmer.png             player          9x16 cut
make Hero/leather.png            hero_leather    9x16 cut
make Boss_Ver02.png              boss_art        32x35 cut
make Campfire/Campfire_1.png     campfire_wood   18x17 cut
make Campfire/Campfire_2.png     campfire_stone  16x18 cut

for s in fireball freeze; do
  make "Spells/$s.png"       "proj_$s"       8x10  cut
  make "Spells/${s}_held.png"  "proj_${s}_cast" 14x12 cut
  make "Spells/${s}_ring.png"  "proj_${s}_hit"  22x24 cut
done
make Spells/fireball_potion.png  icon_fireball   7x9   cut
make Spells/fireball_potion.png  card_fireball   16x19 cut
make Spells/freeze_potion.png    icon_freeze     6x9   cut
make Spells/freeze_potion.png    card_freeze     12x19 cut
make Supplies/health_potion.png  icon_healthSuck 8x9   cut
make Supplies/health_potion.png  card_healthSuck 16x19 cut
make Spells/poison_potion.png    icon_poison     6x9   cut
make Spells/poison_potion.png    card_poison     13x19 cut
make Supplies/health_potion.png  supply_potion   11x13 cut
make Bar/full_beer.png           beer_full       21x24 cut
make Bar/half_empty_beer.png     beer_half       21x21 cut
make Bar/spilled_beer.png        beer_spilled    26x16 cut
make Bar/full_beer.png           mug             8x9   cut
