import type { MerchantKind } from './game/rules';
import Phaser from 'phaser';
import type { MediaManifest } from '../tools/media-manifest';

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
  for (const [k, urls] of Object.entries(m.music)) { load.audio(`music_${k}`, urls); n++; }
  for (const [k, urls] of Object.entries(m.sfx)) { load.audio(`sfx_${k}`, urls); n++; }
  return n;
}

let current: { key: string; sound: Phaser.Sound.BaseSound } | null = null;

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
