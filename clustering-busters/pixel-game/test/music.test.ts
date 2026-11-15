import assert from 'node:assert/strict';
import { test } from 'node:test';
import { musicUrl } from '../src/music.ts';

const files = { menu: ['media/audio/music/menu.mp3?v=1'], village: ['media/audio/music/village.mp3?v=2'], arena: ['media/audio/music/arena.ogg?v=3', 'media/audio/music/arena.mp3?v=3'] };
const any = () => true;

test('a scene plays its own track, or borrows one', () => {
  assert.equal(musicUrl('arena', files, any), files.arena[0]);
  assert.equal(musicUrl('intro', files, any), files.menu[0], 'the intro keeps the menu song going');
  assert.equal(musicUrl('treasury', files, any), files.village[0]);
  assert.equal(musicUrl('victory', files, any), files.menu[0]);
});

test('the first file the browser can play; none = silence', () => {
  assert.equal(musicUrl('arena', files, (u) => !u.includes('.ogg')), files.arena[1]);
  assert.equal(musicUrl('menu', {}, any), null);
  assert.equal(musicUrl('menu', files, () => false), null);
});
