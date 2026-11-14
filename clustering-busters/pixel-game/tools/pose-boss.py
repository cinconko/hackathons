#!/usr/bin/env python3
"""art/Boss.png -> the boss's poses at game size (public/media/sprites/boss_pose_<name>.png, 40x38).

The boss is one drawing with six arms and two legs. To animate him, each limb is cut out of the
BIG drawing along an outline (LIMBS below), turned around its shoulder or hip, and only then is
the whole frame shrunk to game size. Turning at full size and shrinking afterwards keeps the
outlines clean: no torn edges where a limb meets the body.

The game (boot.ts, bossArt) adds the rest: stage colours, the key on his chest, breathing,
the right-facing aim (a mirror of aim), the hit flash.

Run it after changing art/Boss.png:   npm run art      (needs Pillow: python3 -m pip install pillow)
Debug view of the outlines:           python3 tools/pose-boss.py --outlines out.png
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art' / 'Boss.png'
OUT = ROOT / 'public' / 'media' / 'sprites'

# The figure is 32x35 game pixels; the frame adds room for the arms to reach out:
# 4 px left and right, 3 px on top. boot.ts relies on this layout (the key and the waist).
FIG_W, FIG_H, PAD_X, PAD_TOP = 32, 35, 4, 3

# Limb outlines in the trimmed drawing (1107x1209). Earlier limbs own the pixels two outlines share.
# pivot = shoulder or hip: the point the limb turns around.
LIMBS = {
    # his right side (left in the picture): the arm bent up, the arm straight out, the low arm
    'upL':  {'poly': [(170, 0), (440, 0), (440, 300), (380, 330), (300, 280), (200, 215), (170, 120)], 'pivot': (420, 320)},
    'midL': {'poly': [(0, 215), (200, 215), (300, 280), (380, 330), (440, 330), (440, 430), (330, 450), (200, 500), (0, 500)], 'pivot': (430, 380)},
    'lowL': {'poly': [(160, 450), (330, 450), (440, 430), (450, 520), (400, 600), (330, 720), (160, 720)], 'pivot': (430, 470)},
    # his left side
    'upR':  {'poly': [(690, 0), (880, 0), (880, 260), (800, 300), (760, 420), (700, 420), (690, 250)], 'pivot': (720, 330)},
    'midR': {'poly': [(760, 250), (1107, 250), (1107, 420), (760, 420), (720, 380), (700, 300)], 'pivot': (730, 330)},
    'lowR': {'poly': [(700, 470), (1000, 470), (1000, 640), (780, 640), (700, 600)], 'pivot': (720, 530)},
    # legs, from the hips down
    'legL': {'poly': [(200, 860), (560, 900), (560, 1209), (200, 1209)], 'pivot': (420, 880)},
    'legR': {'poly': [(640, 900), (900, 900), (900, 1060), (640, 1060)], 'pivot': (720, 900)},
}
ARMS_L, ARMS_R = ('upL', 'midL', 'lowL'), ('upR', 'midR', 'lowR')

# Each pose: per limb, degrees clockwise on screen, or (degrees, stretch) to also lengthen it from the
# shoulder. 'reach': his left arms are mirrored over to his right side and turned by these degrees
# (drawn behind, darker), so all six point one way.
POSES = {
    'idle':   {},
    'step_l': {'upL': 4, 'midL': -3, 'lowL': 4, 'upR': 4, 'midR': -3, 'lowR': 4, 'legL': 6},
    'step_r': {'upL': -4, 'midL': 3, 'lowL': -4, 'upR': -4, 'midR': 3, 'lowR': -4, 'legR': -6},
    'spread': {'upL': (8, 1.22), 'midL': (0, 1.25), 'lowL': (-10, 1.22), 'upR': (-8, 1.22), 'midR': (0, 1.25), 'lowR': (10, 1.22)},
    'aim':    {'upL': -38, 'midL': 0, 'lowL': 34, 'reach': {'upR': 38, 'midR': 0, 'lowR': -34}},
}


def load():
    im = Image.open(SRC).convert('RGBA')
    return im.crop(im.getbbox())


def masks(im):
    """One mask per limb (only drawn pixels; a pixel belongs to the first limb that claims it)."""
    drawn = im.split()[3].point(lambda a: 255 if a else 0)
    taken = Image.new('L', im.size, 0)
    out = {}
    for name, limb in LIMBS.items():
        m = Image.new('L', im.size, 0)
        ImageDraw.Draw(m).polygon(limb['poly'], fill=255)
        m = Image.composite(Image.new('L', im.size, 0), m, taken)
        m = Image.composite(m, Image.new('L', im.size, 0), drawn)
        taken = Image.composite(Image.new('L', im.size, 255), taken, m)
        out[name] = m
    return out, taken


def cut(im, mask):
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    layer.paste(im, (0, 0), mask)
    return layer


def turned(layer, pivot, move, size, offset):
    """The layer on the padded canvas, turned clockwise around pivot (and stretched away from it)."""
    deg, stretch = move if isinstance(move, tuple) else (move, 1)
    canvas = Image.new('RGBA', size, (0, 0, 0, 0))
    canvas.paste(layer, offset)
    cx, cy = pivot[0] + offset[0], pivot[1] + offset[1]
    if deg:
        canvas = canvas.rotate(-deg, resample=Image.NEAREST, center=(cx, cy))
    if stretch != 1:                                              # each output pixel reads from closer to the pivot
        k = 1 / stretch
        canvas = canvas.transform(size, Image.AFFINE, (k, 0, cx - cx * k, 0, k, cy - cy * k), resample=Image.NEAREST)
    return canvas


def pose(im, limb_masks, body_mask, spec):
    sx, sy = im.width / FIG_W, im.height / FIG_H                  # drawing pixels per game pixel
    ox, oy = round(PAD_X * sx), round(PAD_TOP * sy)
    size = (im.width + 2 * ox, im.height + oy)
    frame = Image.new('RGBA', size, (0, 0, 0, 0))
    reach = spec.get('reach')
    if reach:                                                     # the far arms, behind everything
        mirrored = ImageOps.mirror(im)
        for name, deg in reach.items():
            m = ImageOps.mirror(limb_masks[name])
            px, py = LIMBS[name]['pivot']
            layer = ImageEnhance.Brightness(cut(mirrored, m)).enhance(0.7)
            frame.alpha_composite(turned(layer, (im.width - 1 - px, py), deg, size, (ox, oy)))
    body = Image.composite(Image.new('L', im.size, 0), im.split()[3], body_mask)
    frame.alpha_composite(turned(cut(im, body), (0, 0), 0, size, (ox, oy)))
    for name in LIMBS:
        if reach and name in reach:
            continue                                              # moved over to the other side
        layer = cut(im, limb_masks[name])
        frame.alpha_composite(turned(layer, LIMBS[name]['pivot'], spec.get(name, 0), size, (ox, oy)))
    small = frame.resize((FIG_W + 2 * PAD_X, FIG_H + PAD_TOP), Image.BOX)
    a = small.split()[3].point(lambda v: 255 if v >= 128 else 0)  # hard edges, like the art importer
    small.putalpha(a)
    return small


def outlines(im, limb_masks, path):
    colours = [(255, 0, 0), (0, 255, 0), (0, 128, 255), (255, 0, 255), (255, 255, 0), (0, 255, 255), (255, 128, 0), (255, 255, 255)]
    over = im.copy()
    for (name, m), c in zip(limb_masks.items(), colours):
        over = Image.composite(Image.alpha_composite(over, Image.new('RGBA', im.size, c + (150,))), over, m)
        px, py = LIMBS[name]['pivot']
        ImageDraw.Draw(over).ellipse([px - 14, py - 14, px + 14, py + 14], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=4)
    over.save(path)


def main():
    im = load()
    limb_masks, body_mask = masks(im)
    if len(sys.argv) == 3 and sys.argv[1] == '--outlines':
        outlines(im, limb_masks, sys.argv[2])
        return
    for name, spec in POSES.items():
        pose(im, limb_masks, body_mask, spec).save(OUT / f'boss_pose_{name}.png')
        print(f'  boss_pose_{name}  {FIG_W + 2 * PAD_X}x{FIG_H + PAD_TOP}  <- Boss.png')


if __name__ == '__main__':
    main()
