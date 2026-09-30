import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildQuiz, baseAuthor } from '../js/quiz.js';

const scenes = JSON.parse(readFileSync(new URL('../data/scenes.json', import.meta.url), 'utf8'));

test('baseAuthor strips parenthetical', () => {
  assert.equal(baseAuthor('西塞羅（引梭倫）'), '西塞羅');
  assert.equal(baseAuthor('李白'), '李白');
});

test('every day: 5 questions, 4 unique options containing the answer', () => {
  const seen = { author: 0, meaning: 0 };
  for (let id = 1; id <= 365; id++) {
    const qs = buildQuiz(scenes, id);
    assert.equal(qs.length, 5, `day ${id}`);
    for (const q of qs) {
      const line = scenes[id - 1].lines[q.k - 1];
      seen[q.type]++;
      assert.equal(q.options.length, 4, `day ${id}-${q.k}`);
      assert.equal(new Set(q.options).size, 4, `dup option ${id}-${q.k}`);
      assert.equal(q.options[q.answer], q.type === 'author' ? baseAuthor(line.author) : line.gloss);
      if (q.type === 'author') assert.ok(q.options.every(o => o !== '佚名' && !/^[《〈]/.test(o)), `non-person option ${id}-${q.k}`);
    }
  }
  assert.ok(seen.author > 1000 && seen.meaning > 200, JSON.stringify(seen));
});

test('deterministic', () => {
  assert.deepEqual(buildQuiz(scenes, 42), buildQuiz(scenes, 42));
});

test('佚名 and rare authors become meaning questions', () => {
  const mk = (text, author, gloss) => ({ text, author, source: 's', era: '先秦', gloss });
  const cast = ['甲', '乙', '丙', '丁'];
  const fake = [0, 1, 2].map(n => ({ id: n + 1, category: 'c', lines: [
    mk('a' + n, '佚名', 'ga' + n), mk('r' + n, n === 0 ? '冷僻' : '甲', 'gr' + n),
    ...cast.slice(1).map((a, j) => mk('x' + n + j, a, 'gx' + n + j)),
    mk('y' + n, '乙', 'gy' + n),
  ].slice(0, 5) }));
  const qs = buildQuiz(fake, 1);
  assert.equal(qs[0].type, 'meaning');
  assert.equal(qs[1].type, 'meaning'); // 冷僻只出現 1 次
  assert.equal(qs[2].type, 'author');
});
