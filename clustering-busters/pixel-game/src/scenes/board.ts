import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { BOARD_SIZE, type Score } from '../game/leaderboard';
import { boardFor, loadNick } from '../leaderboard';
import { fadeToScene, FONT, title } from '../ui';

// The leaderboard: the fastest recovered treasuries, nickname and time. After a win (the result
// screen, or the ending's THE END card) it shows your place, your row in gold; from the menu (L)
// just the board. Enter goes on to `after` (the village after a win, else the menu).

export interface BoardData { timeMs?: number; after?: string; fromRun?: boolean }

/** 1:23.4 (the board needs tenths: seconds alone tie too often). */
export function boardTime(ms: number): string {
  const t = Math.floor(ms / 100);
  const m = Math.floor(t / 600);
  const s = Math.floor((t % 600) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${t % 10}`;
}

export class BoardScene extends Phaser.Scene {
  constructor() { super('board'); }

  create(data: BoardData) {
    const after = data.after ?? 'menu';
    this.add.text(WIDTH / 2, 18, 'LEADERBOARD', title(16, '#ffcc44')).setOrigin(0.5);
    this.add.text(WIDTH / 2, 32, 'fastest treasury recovered', { ...FONT, color: '#888888' }).setOrigin(0.5);
    const status = this.add.text(WIDTH / 2, 84, 'asking the town crier...', { ...FONT, color: '#888888' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, HEIGHT - 12, `Enter: ${after === 'menu' ? 'back' : 'to the village'}`, { ...FONT, color: '#aaaaaa' }).setOrigin(0.5);

    void boardFor(data.timeMs).then((b) => {
      if (!this.scene.isActive()) return;
      if (!b) { status.setText('The leaderboard is offline right now.').setColor('#ff8a8a'); return; }
      status.destroy();
      if (!b.top.length) { this.add.text(WIDTH / 2, 84, 'Nobody yet. Be the first!', { ...FONT, color: '#ffffff' }).setOrigin(0.5); return; }
      const me = loadNick();
      const mine = (s: Score) => data.timeMs !== undefined && s.nick === me && s.timeMs === data.timeMs;
      const row = (y: number, rank: number, s: Score, gold: boolean) => {
        const color = gold ? '#ffcc44' : rank <= 3 ? '#ffffff' : '#c8c8d0';
        this.add.text(70, y, `${rank}.`, { ...FONT, color }).setOrigin(1, 0);
        this.add.text(78, y, s.nick, { ...FONT, color });
        this.add.text(WIDTH - 70, y, boardTime(s.timeMs), { ...FONT, color }).setOrigin(1, 0);
        if (rank <= 3) this.add.image(64 - 14, y + 4, `ring_${['superRare', 'rare', 'classic'][rank - 1]}`);   // medals
      };
      b.top.slice(0, BOARD_SIZE).forEach((s, i) => row(44 + i * 11, i + 1, s, mine(s)));
      // your run, below the top 10 if it did not make it
      if (b.rank && b.rank > BOARD_SIZE && data.timeMs !== undefined && me) {
        this.add.text(WIDTH / 2, 44 + BOARD_SIZE * 11, '...', { ...FONT, color: '#666666' }).setOrigin(0.5, 0);
        row(44 + BOARD_SIZE * 11 + 8, b.rank, { nick: me, timeMs: data.timeMs }, true);
      }
      if (b.rank && data.timeMs !== undefined) {
        this.add.text(WIDTH / 2, 32, b.rank === 1 ? 'A NEW RECORD!' : `you placed #${b.rank} of ${b.total}`, { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(1);
      }
    });

    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      fadeToScene(this, after, after === 'village' ? { fromRun: !!data.fromRun } : {}, 400);
    };
    this.time.delayedCall(400, () => {   // a held key from the last screen must not skip this one
      this.input.keyboard?.once('keydown-ENTER', go);
      this.input.keyboard?.once('keydown-ESC', go);
      this.input.once('pointerdown', go);
    });
    drawFrame(this);
    this.cameras.main.fadeIn(400);
  }
}
