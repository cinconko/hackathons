// Media orchestration at runtime: what to load from public/media, which sprites still use the
// placeholder drawn in code, and the sound (music per scene, effects per event).
//
//   preload scene: media/manifest.json ──► queueMedia ──► files load
//   boot scene:    draws a placeholder only for sprites that did not come from a file
//   any scene:     playMusic(this, 'village') / sfx(this, 'hit'), silent when the file is missing
import Phaser from 'phaser';
import type { MediaManifest } from '../tools/media-manifest';

/** One track per scene. File: public/media/audio/music/<key>.ogg (and/or .mp3). */
export const MUSIC_KEYS = ['menu', 'intro', 'village', 'arena', 'treasury', 'victory'] as const;
/** One sound per event. File: public/media/audio/sfx/<key>.ogg (and/or .mp3). */
export const SFX_KEYS = [
  'swing', 'shoot', 'hit', 'hurt', 'block', 'spell', 'ring', 'buy', 'stage', 'victory',
  'door', 'land', 'launch', 'bounce', 'splash', 'levelup',
] as const;
/**
 * The merchant's robe colours. Sprites merchant_<robe>_0/_1 and blanket_<robe>; each deal picks one
 * (robeFor), the blanket matches. Missing files = the default merchant_0/_1 and blanket.
 */
export const ROBES = ['darkblue', 'gray', 'green', 'orange', 'red', 'special'] as const;
export type Robe = (typeof ROBES)[number];

/** The same cards always give the same robe, so it changes with every deal and survives a reload. */
export function robeFor(cards: readonly string[]): Robe {
  let h = 0;
  for (const ch of cards.join(',')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ROBES[h % ROBES.length];
}

export type MusicKey =(typeof MUSIC_KEYS)[number];
export type SfxKey = (typeof SFX_KEYS)[number];

/** What came from files and what the boot scene had to draw (for the checklist screen). */
export const mediaStatus = {
  manifest: null as MediaManifest | null,
  fromFiles: new Set<string>(),
  placeholders: new Map<string, { w: number; h: number }>(),
};

/**
 * Loads every font in the manifest (fonts/<name>.ttf -> family <name>) before the first text is
 * drawn: Phaser paints text onto a canvas once, so a late font would never show. A font that
 * fails to load is skipped (the text falls back to monospace).
 */
export async function loadFonts(m: MediaManifest): Promise<void> {
  await Promise.all(Object.entries(m.fonts ?? {}).map(async ([name, url]) => {
    try {
      const face = new FontFace(name, `url(${url})`);
      await face.load();
      (document.fonts as unknown as Set<FontFace>).add(face);   // add() exists in browsers; this TS lib lacks its typing
    } catch { console.warn(`[media] could not load the font ${url}`); }
  }));
}

export function queueMedia(load: Phaser.Loader.LoaderPlugin, m: MediaManifest): number {
  let n = 0;
  for (const [k, url] of Object.entries(m.sprites)) { load.image(k, url); n++; }
  for (const [k, s] of Object.entries(m.sheets)) { load.spritesheet(k, s.url, { frameWidth: s.frameWidth, frameHeight: s.frameHeight }); n++; }
  for (const [k, urls] of Object.entries(m.music)) { load.audio(`music_${k}`, urls); n++; }
  for (const [k, urls] of Object.entries(m.sfx)) { load.audio(`sfx_${k}`, urls); n++; }
  return n;
}

let current: { key: string; sound: Phaser.Sound.BaseSound } | null = null;

/** Crossfades to this scene's track. No file = the old track fades out and it stays quiet. */
export function playMusic(scene: Phaser.Scene, key: MusicKey) {
  const k = `music_${key}`;
  if (current?.key === k) return;
  const old = current;
  current = null;
  if (old) scene.tweens.add({ targets: old.sound, volume: 0, duration: 600, onComplete: () => old.sound.destroy() });
  if (!scene.cache.audio.exists(k)) return;
  const sound = scene.sound.add(k, { loop: true, volume: 0 });
  sound.play();
  scene.tweens.add({ targets: sound, volume: 0.5, duration: 800 });
  current = { key: k, sound };
}

/** Plays an event's sound if its file exists. */
export function sfx(scene: Phaser.Scene, key: SfxKey, volume = 0.6) {
  const k = `sfx_${key}`;
  if (scene.cache.audio.exists(k)) scene.sound.play(k, { volume });
}

export function soundStatus(cache: Phaser.Cache.BaseCache) {
  return {
    music: MUSIC_KEYS.map((k) => ({ key: k, ok: cache.exists(`music_${k}`) })),
    sfx: SFX_KEYS.map((k) => ({ key: k, ok: cache.exists(`sfx_${k}`) })),
  };
}
