#!/usr/bin/env bash
# Big source art (art/) -> game-size sprites (public/media/sprites/<key>.png).
#
# The team draws big (hundreds of pixels); the game is a 320x180 grid. This shrinks every picture
# to its size in game pixels and saves it under the sprite key the game looks for. Run it after
# adding or changing a file in art/:   npm run art     (needs ImageMagick: brew install imagemagick)
#
# One line per sprite:  <source in art/>  <key>  <width>x<height>  <mode>
#   cut   a cutout: trim the empty border, shrink, hard edges (alpha is either on or off)
#   tile  a texture the game repeats (grass, water, planks): shrink the whole picture
#   ttile like tile, but trim the empty border first (a tile drawn on a bigger canvas)
#   cover fill exactly that size, cropping what sticks out (backgrounds)
#   bob   like cut, but the figure sits 1 pixel lower (frame 2 of an idle animation)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/media/sprites
command -v magick >/dev/null || { echo "ImageMagick is missing: brew install imagemagick"; exit 1; }

make() {
  local src="art/$1" key="$2" size="$3" mode="$4" w="${3%x*}" h="${3#*x}"
  case "$mode" in
    cut)   magick "$src" -trim +repage -filter Box -resize "${size}!" -channel A -threshold 50% +channel "$OUT/$key.png" ;;
    bob)   magick "$src" -trim +repage -filter Box -resize "${w}x$((h - 1))!" -channel A -threshold 50% +channel \
             -background none -gravity south -extent "$size" "$OUT/$key.png" ;;
    tile)  magick "$src" -filter Box -resize "${size}!" "$OUT/$key.png" ;;
    ttile) magick "$src" -trim +repage -filter Box -resize "${size}!" "$OUT/$key.png" ;;
    cover) magick "$src" -filter Box -resize "${size}^" -gravity center -extent "$size" "$OUT/$key.png" ;;
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
# Paths: dirt (camp), cobblestone (village), stone brick (town); the village paves as it grows
make Path_1.png           path_dirt       32x32   ttile
make Path_2.png           path_cobble     40x40   ttile
make Path_3.png           path_brick      40x40   ttile
make Sky03.avif           sky             312x172 cover

# The merchant: one robe colour per deal, the blanket matches. merchant_0/1 + blanket = default.
make Merchant/Merchant_Green.png              merchant_0  16x18 cut
make Merchant/Merchant_Green.png              merchant_1  16x18 bob
make Merchant/Blanket/March_Blanket_Original.png blanket  36x18 cut
for c in DarkBlue Gray Green Orange Red Special; do
  k=$(echo "$c" | tr '[:upper:]' '[:lower:]')
  make "Merchant/Merchant_$c.png"              "merchant_${k}_0" 16x18 cut
  make "Merchant/Merchant_$c.png"              "merchant_${k}_1" 16x18 bob
  make "Merchant/Blanket/March_Blanket_$c.png" "blanket_$k"      36x18 cut
done

# The boss: one picture; boot makes the stage colours, the key and the hit flash, the arena moves it.
make Boss.png                    boss_art        32x35 cut
# Campfire: level 1 wood only, level 2 in a ring of stones (boot adds the flicker frames).
make Campfire/Campfire_1.png     campfire_wood   18x17 cut
make Campfire/Campfire_2.png     campfire_stone  16x18 cut

# Spells (fireball, freeze): the orb flies and is the HUD icon; the casting hand flashes when you
# cast; the large swirl is the merchant's card; the ring bursts where it hits. Drawn at game scale.
for s in fireball freeze; do
  make "Spells/$s.png"       "proj_$s"       8x10  cut
  make "Spells/${s}_held.png"  "proj_${s}_cast" 14x12 cut
  make "Spells/${s}_ring.png"  "proj_${s}_hit"  22x24 cut
done
make Spells/fireball.png         icon_fireball   9x9   cut
make Spells/fireball_large.png   card_fireball   20x19 cut
# Freeze, Health suck and Poison are shown as potions (HUD icon + merchant card), kept tall like the drawings
make Spells/freeze_potion.png    icon_freeze     6x9   cut
make Spells/freeze_potion.png    card_freeze     12x19 cut
make Supplies/health_potion.png  icon_healthSuck 8x9   cut
make Supplies/health_potion.png  card_healthSuck 16x19 cut
make Spells/poison_potion.png    icon_poison     6x9   cut
make Spells/poison_potion.png    card_poison     13x19 cut
# Fisherman's supplies
make Supplies/health_potion.png  supply_potion   11x13 cut
