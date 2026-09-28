// 台北時區的「一年第幾天」與日期 key。瀏覽器與 Node 共用（ESM）。
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' });

export function taipeiDateKey(now = new Date()) {
  return fmt.format(now); // YYYY-MM-DD
}

export function todayIndex(now = new Date()) {
  const [y, m, d] = taipeiDateKey(now).split('-').map(Number);
  const start = Date.UTC(y, 0, 1);
  const cur = Date.UTC(y, m - 1, d);
  const doy = Math.round((cur - start) / 86400000) + 1;
  return Math.min(doy, 365);
}

export function parseDay(qs) {
  const m = /[?&]d=(\d+)(?:&|$)/.exec(qs || '');
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 365 ? n : null;
}
