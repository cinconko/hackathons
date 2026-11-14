# Oblak: design system

White-first. Built on the Six Cats palette. Every colour pair below is checked against WCAG 2.1 contrast.

## Colour palette

| Token | Hex | Use |
|---|---|---|
| `black` | `#000000` | Main text, primary button text, dark mode background |
| `slate` | `#374750` | Secondary text, card borders in light mode, dark-mode cards |
| `white` | `#FFFFFF` | Light-mode background and cards |
| `green` | `#55BF2B` | Brand fill: primary buttons, hero banner, logo tile (always with black text on top) |
| `blue` | `#2D7BD0` | Focus rings, active states, decorative accents |

Derived shades, needed for text on white (the palette colours fail contrast as text on white):

| Token | Hex | Use | Contrast on white |
|---|---|---|---|
| `green-text` | `#2F7A12` | Green text on white ("secure" labels) | 5.37 (AA pass) |
| `blue-text` | `#1F5FA6` | Links, accent text on white | 6.47 (AA pass) |
| `border` | `#D5DDE2` | Card and field borders on white (tint of slate) | decorative |
| `field` | `#F4F6F7` | Input background | decorative |

Alert colours, required by the security GUI skill (not in the palette). Only for warnings, never for idle states:

| Token | Hex | Use | Contrast on white |
|---|---|---|---|
| `alert` | `#B91C1C` | Scam verdict, sensitive-data warning | 6.47 (AA pass) |
| `warn` | `#B45309` | "Be careful" verdict | 5.02 (AA pass) |

## Contrast rules (checked)

| Pair | Ratio | Verdict |
|---|---|---|
| `black` on `white` | 21.0 | AAA |
| `slate` on `white` | 9.63 | AAA |
| `black` on `green` | 8.87 | AAA. **Use this for buttons and the hero banner.** |
| `white` on `green` | 2.37 | **Fails. Never use.** |
| `white` on `blue` | 4.32 | Fails for normal text. Use only for large text (18px+ bold). |
| `black` on `blue` | 4.86 | AA pass |
| `blue` on `white` | 4.32 | Fails for text. Use `blue-text` instead. |

## Typography

- **Font:** Figtree (Google Fonts), the same font as malesporty.cz (`--font-ui`), with system fallback.
- **Weights used:** 400 (body), 700 (labels and buttons), 800 (titles and verdicts).

| Role | Size / weight | Line height |
|---|---|---|
| Page title | 24px / 800 | 1.2 |
| Hero title | 20px / 800 | 1.3 |
| Card title | 16px / 700 | 1.3 |
| Verdict label | 20px / 800 | 1.3 |
| Body | 15px / 400 | 1.45 (22px lines) |
| Small / meta | 13px / 400 | 1.4 |
| Button label | 15px / 700 | 1 |

Minimum body size is 15px. Nothing below 13px.

## Layout and spacing

- Page margin: 16px. Card padding: 16px. Gap between cards: 16px.
- Radius: 14px cards, 10px fields and buttons, 16px hero banner.
- Button height: 40px (touch target above 40px on phones).
- Two columns from 760px wide. One column below that.

## Figtreeface rules

1. **Colour is never the only signal.** Every verdict has an icon and a text label.
2. **Idle state has no red or amber.** Warnings appear only when something is found.
3. **Focus is always visible** (3px blue outline on inputs and buttons).
4. **One primary action per card.** Primary buttons are green with black text. Secondary buttons are outlined.
5. **Warnings explain what to do** in one sentence, in plain Czech.
