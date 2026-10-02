import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayIndex, parseDay, taipeiDateKey, shiftDateKey } from '../js/day.js';
import { streak, streakInfo, doneDate, earnedBadges, nextBadge, loadDone } from '../js/progress.js';

test('day of year in Taipei', () => {
  assert.equal(todayIndex(new Date('2026-01-01T00:30:00+08:00')), 1);
  assert.equal(todayIndex(new Date('2026-12-31T23:00:00+08:00')), 365);
  assert.equal(todayIndex(new Date('2028-12-31T12:00:00+08:00')), 365); // leap 366 → 365
  assert.equal(todayIndex(new Date('2026-01-01T15:59:00Z')), 1); // 台北 23:59
  assert.equal(todayIndex(new Date('2026-01-01T16:00:00Z')), 2); // 台北 00:00 次日
  assert.equal(todayIndex(new Date('2026-03-01T08:00:00+08:00')), 60);
});

test('taipeiDateKey', () => {
  assert.equal(taipeiDateKey(new Date('2026-01-01T16:00:00Z')), '2026-01-02');
});

test('parseDay', () => {
  assert.equal(parseDay('?d=0'), null);
  assert.equal(parseDay('?d=366'), null);
  assert.equal(parseDay('?d=abc'), null);
  assert.equal(parseDay(''), null);
  assert.equal(parseDay('?d=42'), 42);
  assert.equal(parseDay('?x=1&d=365'), 365);
});

test('streak counts through yesterday when today not done', () => {
  const list = [{ d: '2026-09-26', id: 1 }, { d: '2026-09-27', id: 2 }, { d: '2026-09-28', id: 3 }];
  assert.equal(streak(list, '2026-09-29'), 3);
  assert.equal(streak(list, '2026-09-28'), 3);
  assert.equal(streak(list, '2026-09-30'), 0);
});

test('doneDate: 補昨天那課且昨天沒紀錄 → 記昨天，連續天數接得回來', () => {
  const list = [{ d: '2026-09-27', id: 1 }, { d: '2026-09-28', id: 2 }];
  assert.equal(doneDate(list, true, '2026-09-30'), '2026-09-29');
  assert.equal(streak([...list, { d: '2026-09-29', id: 3 }], '2026-09-30'), 3);
  assert.equal(doneDate(list, false, '2026-09-30'), '2026-09-30');
  assert.equal(doneDate([...list, { d: '2026-09-29', id: 9 }], true, '2026-09-30'), '2026-09-30');
});

const run = (from, n) => Array.from({ length: n }, (_, i) => ({ d: shiftDateKey(from, i), id: i + 1 }));
test('保護卡：連續 7 天得 1 張，斷 1 天自動用掉、連續不歸零', () => {
  const list = run('2026-09-01', 7); // 9/1–9/7
  assert.deepEqual(streakInfo(list, '2026-09-08'), { streak: 7, freezes: 1, used: 0 });
  assert.deepEqual(streakInfo(list, '2026-09-09'), { streak: 7, freezes: 0, used: 1 }); // 9/8 沒練 → 用掉
  assert.equal(streak([...list, { d: '2026-09-09', id: 99 }], '2026-09-09'), 8);
  assert.equal(streak(list, '2026-09-10'), 0); // 斷兩天、卡不夠 → 歸零
  assert.equal(streakInfo(run('2026-09-01', 28), '2026-09-28').freezes, 2); // 最多存 2 張
});
test('里程碑：累計天數與開口次數', () => {
  assert.deepEqual(earnedBadges(0, 0), []);
  assert.deepEqual(earnedBadges(21, 600).map(b => b.label), ['七日', '廿一', '開口五百']);
  assert.deepEqual(nextBadge(21, 600), { label: '五十', left: '還差 29 天' });
  assert.deepEqual(nextBadge(365, 5000), null);
});

test('舊版日期字串紀錄可讀', () => {
  const mem = { 'dq365.done': JSON.stringify(['2026-09-28', '2026-09-29']) };
  globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  assert.deepEqual(loadDone(), [{ d: '2026-09-28', id: null }, { d: '2026-09-29', id: null }]);
  assert.equal(streak(loadDone(), '2026-09-29'), 2);
  delete globalThis.localStorage;
});
