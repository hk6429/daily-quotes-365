import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayIndex, parseDay, taipeiDateKey } from '../js/day.js';

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
