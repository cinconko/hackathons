// Turns the file list of public/media into the manifest the game loads (media/manifest.json).
// Pure: no file system here, so it is easy to test. vite.config.ts walks the folder and calls it.
//
//   sprites/<key>.png|webp            -> sprites[key]        replaces the placeholder drawn in code
//   sheets/<key>@<w>x<h>.png|webp     -> sheets[key]         a sprite sheet with w x h frames
//   audio/music/<key>.ogg|mp3|m4a|wav -> music[key]          several formats of one track are grouped
//   audio/sfx/<key>.ogg|mp3|m4a|wav   -> sfx[key]
//   fonts/<name>.ttf|otf|woff|woff2   -> fonts[name]         loaded before the first screen
// Anything else (README.md, .gitkeep, wrong names) is ignored and reported in `skipped`.

export interface SheetEntry { url: string; frameWidth: number; frameHeight: number }
export interface MediaManifest {
  sprites: Record<string, string>;
  sheets: Record<string, SheetEntry>;
  music: Record<string, string[]>;
  sfx: Record<string, string[]>;
  fonts: Record<string, string>;
  skipped: string[];
}

const KEY = '[A-Za-z0-9_]+';
const IMAGE = '(?:png|webp)';
const AUDIO = ['ogg', 'mp3', 'm4a', 'wav'];   // order = preference: the browser takes the first it can play
const SPRITE_RE = new RegExp(`^sprites/(${KEY})\\.${IMAGE}$`);
const SHEET_RE = new RegExp(`^sheets/(${KEY})@(\\d+)x(\\d+)\\.${IMAGE}$`);
const FONT_RE = new RegExp(`^fonts/(${KEY})\\.(?:ttf|otf|woff2?)$`);
const AUDIO_RE = new RegExp(`^audio/(music|sfx)/(${KEY})\\.(${AUDIO.join('|')})$`);
const QUIET = /(^|\/)(README\.md|\.gitkeep|\.DS_Store|manifest\.json)$/;

/** files: paths relative to public/media, with forward slashes. Urls are relative to the page. */
export function buildManifest(files: readonly string[]): MediaManifest {
  const m: MediaManifest = { sprites: {}, sheets: {}, music: {}, sfx: {}, fonts: {}, skipped: [] };
  for (const f of [...files].sort()) {
    const url = `media/${f}`;
    let r: RegExpExecArray | null;
    if ((r = SPRITE_RE.exec(f))) m.sprites[r[1]] = url;
    else if ((r = SHEET_RE.exec(f))) m.sheets[r[1]] = { url, frameWidth: Number(r[2]), frameHeight: Number(r[3]) };
    else if ((r = FONT_RE.exec(f))) m.fonts[r[1]] = url;
    else if ((r = AUDIO_RE.exec(f))) {
      const group = r[1] === 'music' ? m.music : m.sfx;
      (group[r[2]] ??= []).push(url);
    } else if (!QUIET.test(f)) m.skipped.push(f);
  }
  const ext = (u: string) => AUDIO.indexOf(u.slice(u.lastIndexOf('.') + 1));
  for (const g of [m.music, m.sfx]) for (const k of Object.keys(g)) g[k].sort((a, b) => ext(a) - ext(b));
  return m;
}
