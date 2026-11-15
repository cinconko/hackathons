import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bouncedBackLines, talk, type NpcId, type NpcState } from '../src/game/npcs.ts';
import { seededRng } from '../src/game/rules.ts';

const base: NpcState = { wins: 0, villageLevel: 1, villageName: 'Camp', hasWeapon: false, ownsArmor: false, kidGiftGiven: false };

test('everyone always has something to say', () => {
  for (const id of ['elder', 'kid', 'sergeant'] as NpcId[]) {
    for (let seed = 0; seed < 50; seed++) {
      for (const s of [base, { ...base, wins: 3, villageLevel: 6, villageName: 'Ringfall City', hasWeapon: true, ownsArmor: true, kidGiftGiven: true }]) {
        const t = talk(id, s, seededRng(seed));
        assert.ok(t.lines.length > 0 && t.lines.every((l) => l.length > 0), `${id} ${seed}`);
      }
    }
  }
});

test('Tobi gives his ring only while it has not been given', () => {
  assert.equal(talk('kid', base, seededRng(1)).giftRing, true);
  assert.equal(talk('kid', { ...base, kidGiftGiven: true }, seededRng(1)).giftRing, undefined);
});

test('the elder and the sergeant follow your progress', () => {
  assert.ok(talk('elder', base, seededRng(1)).lines.some((l) => l.includes('buy a weapon')));
  assert.ok(!talk('elder', { ...base, hasWeapon: true }, seededRng(1)).lines.some((l) => l.includes('buy a weapon')));
  assert.ok(talk('elder', { ...base, wins: 2 }, seededRng(1)).lines[0].includes('2 times'));
  assert.ok(talk('sergeant', base, seededRng(1)).lines.some((l) => l.includes('armor')));
  assert.ok(!talk('sergeant', { ...base, ownsArmor: true }, seededRng(1)).lines.some((l) => l.includes('No armor')));
});

test('Grandpa greets you when Mossback bounced you home, and counts the rings you kept', () => {
  assert.equal(bouncedBackLines(0)[0], 'You have been bounced back!');
  assert.match(bouncedBackLines(0)[1], /No rings/);
  assert.match(bouncedBackLines(1)[1], /kept 1 ring\./);
  assert.match(bouncedBackLines(3)[1], /kept 3 rings\./);
});
