import type { MusicKey } from './media';

// Scenes without their own track borrow one, so the menu -> intro move keeps the same song playing.
export const MUSIC_FALLBACK: Readonly<Partial<Record<MusicKey, MusicKey>>> = { intro: 'menu', treasury: 'village', victory: 'menu' };

/** The URL a scene's music streams from: its own file, else its fallback's; the first the browser can play. */
export function musicUrl(key: MusicKey, music: Readonly<Record<string, readonly string[]>>, canPlay: (url: string) => boolean): string | null {
  const urls = music[key] ?? (MUSIC_FALLBACK[key] ? music[MUSIC_FALLBACK[key]!] : undefined);
  return urls?.find(canPlay) ?? null;
}

const VOLUME = 0.5;
const FADE_IN_MS = 800;
const FADE_OUT_MS = 600;

/** Music streamed with <audio> (no preload, no decoded PCM in memory), crossfaded, obeying mute and pauses. */
class MusicPlayer {
  private current: { url: string; el: HTMLAudioElement } | null = null;
  private muted = false;
  private pausedByGame = false;
  private waitingForGesture = false;

  play(url: string | null) {
    if (this.current?.url === url) return;
    if (this.current) this.fadeOut(this.current.el);
    this.current = null;
    if (!url) return;
    const el = new Audio(url);
    el.loop = true;
    el.volume = 0;
    el.muted = this.muted;
    this.current = { url, el };
    this.start();
  }

  setMuted(m: boolean) { this.muted = m; if (this.current) this.current.el.muted = m; }
  pauseGame() { this.pausedByGame = true; this.current?.el.pause(); }
  resumeGame() { this.pausedByGame = false; this.start(); }
  onVisibility(hidden: boolean) { if (hidden) this.current?.el.pause(); else this.start(); }

  private start() {
    const cur = this.current;
    if (!cur || this.pausedByGame || document.hidden) return;
    cur.el.play().then(() => fade(cur.el, VOLUME, FADE_IN_MS), () => this.afterGesture());
  }

  // Browsers block sound until the player clicks or presses a key: try again then.
  private afterGesture() {
    if (this.waitingForGesture) return;
    this.waitingForGesture = true;
    const go = () => {
      this.waitingForGesture = false;
      window.removeEventListener('pointerdown', go, true);
      window.removeEventListener('keydown', go, true);
      this.start();
    };
    window.addEventListener('pointerdown', go, true);
    window.addEventListener('keydown', go, true);
  }

  private fadeOut(el: HTMLAudioElement) {
    fade(el, 0, FADE_OUT_MS, () => { el.pause(); el.removeAttribute('src'); el.load(); });
  }
}

function fade(el: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = el.volume;
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    el.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step); else done?.();
  };
  requestAnimationFrame(step);
}

export const music = new MusicPlayer();
let attached = false;

/** Hook the player to the game's sound manager (M mutes; the page's pauseAll/resumeAll) and to hidden tabs. */
export function attachMusic(sound: Phaser.Sound.BaseSoundManager) {
  if (attached) return;
  attached = true;
  music.setMuted(sound.mute);
  sound.on('mute', (_: unknown, m: boolean) => music.setMuted(m));
  sound.on('pauseall', () => music.pauseGame());
  sound.on('resumeall', () => music.resumeGame());
  document.addEventListener('visibilitychange', () => music.onVisibility(document.hidden));
}
