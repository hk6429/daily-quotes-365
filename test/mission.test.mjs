import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, initial, advance, needsAudio, progress, total, plan, loadMission, saveMission } from '../js/mission.js';

const mem = {};
const useMem = () => { for (const k in mem) delete mem[k]; globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } }; };

test('四關定義', () => {
  assert.equal(STAGES.length, 4);
  assert.deepEqual(STAGES.map(s => [s.text, s.gloss, s.audio]), [[true, true, 'each'], [true, false, 'first'], [false, false, 'first'], [false, false, 'none']]);
});
test('完整版 100 次、輕量版 30 次（關一、三、四各 2 輪）', () => {
  assert.equal(total(false), 100); assert.equal(total(true), 30);
  assert.deepEqual(plan(false).stages, [1, 2, 3, 4]); assert.deepEqual(plan(true).stages, [1, 3, 4]);
});
for (const lite of [false, true]) {
  test(`${lite ? '輕量' : '完整'}版：連念到完成，進度逐次 +1`, () => {
    let st = initial(lite);
    for (let i = 0; i < total(lite); i++) { assert.equal(st.done, false); assert.equal(progress(st), i); st = advance(st); }
    assert.equal(st.done, true); assert.equal(progress(st), total(lite));
    assert.deepEqual(advance(st), st);
  });
}
test('每關都是五句輪流：第 5 句後回第 1 句、輪數 +1；滿輪換下一關', () => {
  let st = initial(false);
  for (let i = 0; i < 5; i++) st = advance(st);
  assert.deepEqual(st, { stage: 1, k: 1, n: 1, done: false, lite: false });
  for (let i = 0; i < 20; i++) st = advance(st);
  assert.deepEqual(st, { stage: 2, k: 1, n: 0, done: false, lite: false });
  let l = initial(true);
  for (let i = 0; i < 10; i++) l = advance(l);
  assert.equal(l.stage, 3); // 輕量版跳過關二
});
test('needsAudio：關一每次、關二三只有第一輪、關四不播', () => {
  assert.equal(needsAudio({ stage: 1, k: 3, n: 4 }), true);
  assert.equal(needsAudio({ stage: 2, k: 4, n: 0 }), true);
  assert.equal(needsAudio({ stage: 3, k: 2, n: 1 }), false);
  assert.equal(needsAudio({ stage: 4, k: 1, n: 0 }), false);
});
test('進度依情境保存 3 天：隔天接續、第 3 天後重來', () => {
  useMem();
  saveMission(7, { stage: 2, k: 3, n: 1, done: false, lite: false }, '2026-10-01');
  assert.deepEqual(loadMission(7, '2026-10-02'), { stage: 2, k: 3, n: 1, done: false, lite: false });
  assert.deepEqual(loadMission(7, '2026-10-03'), { stage: 2, k: 3, n: 1, done: false, lite: false });
  assert.deepEqual(loadMission(7, '2026-10-04'), initial());
  assert.deepEqual(loadMission(8, '2026-10-01'), initial());
  saveMission(9, initial(), '2026-10-05');
  assert.deepEqual(Object.keys(JSON.parse(mem['dq365.mission'])), ['9']); // 過期的清掉
});
test('舊格式（日期鍵）可讀', () => {
  useMem();
  mem['dq365.mission'] = JSON.stringify({ '2026-10-02': { 5: { stage: 3, k: 2, n: 0, done: false } } });
  assert.deepEqual(loadMission(5, '2026-10-02'), { stage: 3, k: 2, n: 0, done: false, lite: false });
});
test('壞資料回初始', () => {
  useMem();
  mem['dq365.mission'] = JSON.stringify({ 1: { stage: 2, k: 1.5, n: 0, done: false, t: '2026-10-02' }, 2: { stage: 1, k: 1, n: 5, done: false, t: '2026-10-02' }, 3: { stage: 2, k: 1, n: 0, done: false, lite: true, t: '2026-10-02' }, 4: { stage: 9, t: '2026-10-02' } });
  for (const id of [1, 2, 3, 4]) assert.deepEqual(loadMission(id, '2026-10-02'), initial());
  mem['dq365.mission'] = '{壞掉';
  assert.deepEqual(loadMission(1, '2026-10-02'), initial());
  delete globalThis.localStorage;
});
