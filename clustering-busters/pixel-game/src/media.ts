import type { MerchantKind } from './game/rules';
import Phaser from 'phaser';
import type { MediaManifest } from '../tools/media-manifest';
import { attachMusic, music, musicUrl, MUSIC_FALLBACK } from './music';

export const MUSIC_KEYS = ['menu', 'intro', 'village', 'arena', 'treasury', 'victory'] as const;
export const SFX_KEYS = [
  'swing', 'shoot', 'hit', 'hurt', 'block', 'spell', 'ring', 'buy', 'stage', 'victory',
  'door', 'land', 'launch', 'bounce', 'splash', 'levelup',
] as const;
export const ROBES = ['darkblue', 'gray', 'green', 'orange', 'red', 'special'] as const;
export type Robe = (typeof ROBES)[number];

export const MERCHANT_ROBES: Readonly<Record<MerchantKind, Robe>> = {
  ranger: 'darkblue', smith: 'red', armorer: 'gray', alchemist: 'green', peddler: 'orange', special: 'special',
};

export type MusicKey =(typeof MUSIC_KEYS)[number];
export type SfxKey = (typeof SFX_KEYS)[number];

export const mediaStatus = {
  manifest: null as MediaManifest | null,
  fromFiles: new Set<string>(),
  placeholders: new Map<string, { w: number; h: number }>(),
};

export async function loadFonts(m: MediaManifest): Promise<void> {
  await Promise.all(Object.entries(m.fonts ?? {}).map(async ([name, url]) => {
    try {
      const face = new FontFace(name, `url(${url})`);
      await face.load();
      (document.fonts as unknown as Set<FontFace>).add(face);
    } catch { console.warn(`[media] could not load the font ${url}`); }
  }));
}

export function queueMedia(load: Phaser.Loader.LoaderPlugin, m: MediaManifest): number {
  let n = 0;
  for (const [k, url] of Object.entries(m.sprites)) { load.image(k, url); n++; }
  for (const [k, s] of Object.entries(m.sheets)) { load.spritesheet(k, s.url, { frameWidth: s.frameWidth, frameHeight: s.frameHeight }); n++; }
  for (const [k, urls] of Object.entries(m.sfx)) { load.audio(`sfx_${k}`, urls); n++; }
  return n;
}

// Music streams (src/music.ts): it is never preloaded, so it can't delay the game's start.
let probe: HTMLAudioElement | null = null;
const canPlay = (url: string) => { const ext = url.split('?')[0].split('.').pop(); return (probe ??= new Audio()).canPlayType(ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`) !== ''; };

export function playMusic(scene: Phaser.Scene, key: MusicKey) {
  attachMusic(scene.game.sound);
  music.play(musicUrl(key, mediaStatus.manifest?.music ?? {}, canPlay));
}

export function sfx(scene: Phaser.Scene, key: SfxKey, volume = 0.6) {
  const k = `sfx_${key}`;
  if (scene.cache.audio.exists(k)) scene.sound.play(k, { volume });
}

export function soundStatus(cache: Phaser.Cache.BaseCache) {
  return {
    music: MUSIC_KEYS.map((k) => ({ key: k, ok: !!mediaStatus.manifest?.music[k] || !!(MUSIC_FALLBACK[k] && mediaStatus.manifest?.music[MUSIC_FALLBACK[k]!]) })),
    sfx: SFX_KEYS.map((k) => ({ key: k, ok: cache.exists(`sfx_${k}`) })),
  };
}
