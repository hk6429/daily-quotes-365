// 今日口說任務：四關跟讀的規則與進度（純函式＋localStorage，不碰 DOM）。
import { taipeiDateKey, daysBetween } from './day.js';

export const STAGES = [
  { n: 1, name: '看原句＋白話，跟著原音同步念', text: true, gloss: true, audio: 'each' },
  { n: 2, name: '只看原句，先聽一次再自己念', text: true, gloss: false, audio: 'first' },
  { n: 3, name: '字全遮，先聽一次再自己念', text: false, gloss: false, audio: 'first' },
  { n: 4, name: '字全遮不播音，五句連著背出來', text: false, gloss: false, audio: 'none' },
];
export const LINES = 5;
const KEEP_DAYS = 3;
const KEY = 'dq365.mission';

// 完整版：四關各 5 輪＝100 次；輕量版：關一、三、四各 2 輪＝30 次
export const plan = lite => (lite ? { stages: [1, 3, 4], reps: 2 } : { stages: [1, 2, 3, 4], reps: 5 });
export const total = lite => { const p = plan(lite); return p.stages.length * p.reps * LINES; };
export const initial = (lite = false) => ({ stage: 1, k: 1, n: 0, done: false, lite });

// 念過一次 → 下一個狀態。每關都是五句輪流：k 走完 5 句算一輪（n＝已完成輪數），滿輪換下一關
export function advance(st) {
  if (st.done) return st;
  const { stages, reps } = plan(st.lite);
  let { stage, k, n } = st;
  k++; if (k > LINES) { k = 1; n++; }
  if (n === reps) {
    const i = stages.indexOf(stage) + 1;
    if (i === stages.length) return { stage, k: LINES, n: reps, done: true, lite: st.lite };
    stage = stages[i]; n = 0;
  }
  return { stage, k, n, done: false, lite: st.lite };
}

export function needsAudio(st) {
  const a = STAGES[st.stage - 1].audio;
  return a === 'each' || (a === 'first' && st.n === 0);
}

export function progress(st) {
  if (st.done) return total(st.lite);
  const { stages, reps } = plan(st.lite);
  return stages.indexOf(st.stage) * reps * LINES + st.n * LINES + (st.k - 1);
}

const valid = v => {
  if (!v || typeof v !== 'object' || typeof v.done !== 'boolean') return false;
  const { stages, reps } = plan(!!v.lite);
  return stages.includes(v.stage) && Number.isInteger(v.k) && v.k >= 1 && v.k <= LINES
    && Number.isInteger(v.n) && v.n >= 0 && (v.n < reps || v.done);
};
// 儲存格式 { [sceneId]: {stage,k,n,done,lite,t} }；舊格式 { 'YYYY-MM-DD': { [sceneId]: st } } 讀進來時轉換
function readAll() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}'); if (!o || typeof o !== 'object') return {};
    const out = {};
    for (const [key, v] of Object.entries(o)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) { for (const [id, st] of Object.entries(v || {})) if (st && typeof st === 'object') out[id] = { ...st, t: key }; }
      else out[key] = v;
    }
    return out;
  } catch { return {}; }
}
const fresh = (v, today) => v && typeof v.t === 'string' && daysBetween(v.t, today) < KEEP_DAYS;

export function loadMission(id, today = taipeiDateKey()) {
  const v = readAll()[id];
  return fresh(v, today) && valid(v) ? { stage: v.stage, k: v.k, n: v.n, done: v.done, lite: !!v.lite } : initial();
}
export function saveMission(id, st, today = taipeiDateKey()) {
  try {
    const all = readAll(); const keep = {};
    for (const [k, v] of Object.entries(all)) if (fresh(v, today)) keep[k] = v;
    keep[id] = { ...st, t: today };
    localStorage.setItem(KEY, JSON.stringify(keep));
  } catch {}
}
