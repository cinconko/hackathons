import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildManifest } from '../tools/media-manifest.ts';

test('sprites, sheets, music and sfx are sorted into the manifest', () => {
  const m = buildManifest([
    'sprites/boss_1.png', 'sprites/player.webp',
    'sheets/player@8x10.png',
    'audio/music/village.mp3', 'audio/music/village.ogg',
    'audio/sfx/hit.wav',
    'README.md', 'sprites/.gitkeep', 'audio/.gitkeep',
  ]);
  assert.deepEqual(m.sprites, { boss_1: 'media/sprites/boss_1.png', player: 'media/sprites/player.webp' });
  assert.deepEqual(m.sheets, { player: { url: 'media/sheets/player@8x10.png', frameWidth: 8, frameHeight: 10 } });
  assert.deepEqual(m.music, { village: ['media/audio/music/village.ogg', 'media/audio/music/village.mp3'] }); // ogg first
  assert.deepEqual(m.sfx, { hit: ['media/audio/sfx/hit.wav'] });
  assert.deepEqual(m.skipped, []);
});

test('files with wrong names are reported, not silently used', () => {
  const m = buildManifest(['sprites/Boss 1.png', 'sprites/boss.jpg', 'sheets/player.png', 'audio/music/x.flac', 'other/thing.png']);
  assert.deepEqual(Object.keys(m.sprites), []);
  assert.deepEqual(Object.keys(m.sheets), []);
  assert.equal(m.skipped.length, 5);
});

test('an empty media folder gives an empty manifest', () => {
  assert.deepEqual(buildManifest([]), { sprites: {}, sheets: {}, music: {}, sfx: {}, skipped: [] });
});
