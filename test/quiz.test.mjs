import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildQuiz, baseAuthor } from '../js/quiz.js';

const scenes = JSON.parse(readFileSync(new URL('../data/scenes.json', import.meta.url), 'utf8'));

test('baseAuthor strips parenthetical', () => {
  assert.equal(baseAuthor('西塞羅（引梭倫）'), '西塞羅');
  assert.equal(baseAuthor('李白'), '李白');
});

test('every day: 4 unique options, contains answer, no 佚名 options', () => {
  let total = 0;
  for (let id = 1; id <= 365; id++) {
    for (const q of buildQuiz(scenes, id)) {
      total++;
      assert.equal(q.options.length, 4, `day ${id}-${q.k}`);
      assert.equal(new Set(q.options).size, 4, `dup option ${id}-${q.k}`);
      assert.equal(q.options[q.answer], baseAuthor(scenes[id - 1].lines[q.k - 1].author));
      assert.ok(!q.options.includes('佚名'));
    }
  }
  assert.ok(total > 1500, `only ${total} questions`);
});

test('deterministic', () => {
  assert.deepEqual(buildQuiz(scenes, 42), buildQuiz(scenes, 42));
});

test('skips 佚名 lines', () => {
  const fake = [{ id: 1, lines: [
    { text: 'a', author: '佚名', source: 's', era: '先秦', gloss: 'g' },
    ...['甲', '乙', '丙', '丁'].map(a => ({ text: a, author: a, source: 's', era: '先秦', gloss: 'g' })),
  ] }];
  const qs = buildQuiz(fake, 1);
  assert.equal(qs.length, 4);
  assert.ok(qs.every(q => q.k !== 1));
});
