// 練習紀錄（localStorage）：[{d:'YYYY-MM-DD', id}]；連續天數＋保護卡、里程碑、開口次數。
import { taipeiDateKey, shiftDateKey } from './day.js';

const KEY = 'dq365.done'; // 舊資料是日期字串陣列，讀取時轉成 {d, id:null}
const IDS = 'dq365.doneDays'; // 封存頁用的已完成主題 id（舊版就有）

export function loadDone() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return raw.map(x => (typeof x === 'string' ? { d: x, id: null } : x)).filter(x => x && x.d);
  } catch { return []; }
}
export function saveDone(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} }

export function markDone(id, today = taipeiDateKey()) {
  const list = loadDone();
  if (!list.some(x => x.d === today && x.id === id)) list.push({ d: today, id });
  saveDone(list);
  try { const ids = new Set(JSON.parse(localStorage.getItem(IDS) || '[]')); ids.add(id); localStorage.setItem(IDS, JSON.stringify([...ids])); } catch {}
  return list;
}

// 練過的主題 id：完成紀錄＋舊版 dq365.doneDays
export function doneIds(list = loadDone()) {
  let old = []; try { old = JSON.parse(localStorage.getItem(IDS) || '[]'); } catch {}
  return new Set([...old, ...list.map(x => x.id).filter(x => x != null)]);
}
export function isDoneToday(list, id, today = taipeiDateKey()) { return list.some(x => x.d === today && x.id === id); }

// 連續天數＋保護卡：從第一筆紀錄逐日走到今天；每連續練滿 7 天得 1 張保護卡（最多存 2 張），
// 漏練一天自動用掉 1 張、連續不歸零；今天還沒練不算漏。
export function streakInfo(list, today = taipeiDateKey()) {
  const days = new Set(list.map(x => x.d));
  if (!days.size) return { streak: 0, freezes: 0, used: 0 };
  let cur = [...days].sort()[0], run = 0, freezes = 0, used = 0;
  while (cur <= today) {
    if (days.has(cur)) { run++; if (run % 7 === 0 && freezes < 2) freezes++; }
    else if (cur !== today) { if (run > 0 && freezes > 0) { freezes--; used++; } else run = 0; }
    cur = shiftDateKey(cur, 1);
  }
  return { streak: run, freezes, used };
}
export const streak = (list, today = taipeiDateKey()) => streakInfo(list, today).streak;

export function practicedDays(list) { return new Set(list.map(x => x.d)).size; }

// 完成紀錄記在哪天：補的是昨天那課、且昨天沒有紀錄 → 記昨天，讓「補一課」真的接回連續天數
export function doneDate(list, isYesterdayLesson, today = taipeiDateKey()) {
  const y = shiftDateKey(today, -1);
  return isYesterdayLesson && !list.some(x => x.d === y) ? y : today;
}

// 里程碑：累計練習天數、累計開口次數（口說任務每計一次 +1）
const BADGES = [
  { label: '七日', days: 7 }, { label: '廿一', days: 21 }, { label: '五十', days: 50 }, { label: '百日', days: 100 }, { label: '一年', days: 365 },
  { label: '開口五百', voice: 500 }, { label: '開口一千', voice: 1000 }, { label: '開口五千', voice: 5000 },
];
const got = (b, days, voice) => (b.days ? days >= b.days : voice >= b.voice);
export const earnedBadges = (days, voice) => BADGES.filter(b => got(b, days, voice));
export function nextBadge(days, voice) {
  const b = BADGES.find(x => x.days && !got(x, days, voice)) || BADGES.find(x => !got(x, days, voice));
  return b ? { label: b.label, left: b.days ? `還差 ${b.days - days} 天` : `還差開口 ${b.voice - voice} 次` } : null;
}
const VKEY = 'dq365.voice';
export function loadVoice() { try { return Math.max(0, parseInt(localStorage.getItem(VKEY), 10) || 0); } catch { return 0; } }
export function addVoice() { try { localStorage.setItem(VKEY, String(loadVoice() + 1)); } catch {} }
