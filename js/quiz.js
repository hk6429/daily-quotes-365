// 猜作者：每句出 4 選 1，干擾項優先取同時代作者。純函式，瀏覽器與 Node 共用。
export const baseAuthor = a => a.replace(/（.*$/, '').trim();

const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const rng = seed => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (a, r) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

let poolCache = null, poolFor = null;
function pools(scenes) {
  if (poolFor === scenes) return poolCache;
  const byEra = {};
  for (const s of scenes) for (const l of s.lines) {
    const a = baseAuthor(l.author);
    if (a === '佚名') continue;
    (byEra[l.era] ||= new Set()).add(a);
  }
  poolFor = scenes; poolCache = byEra;
  return byEra;
}

export function buildQuiz(scenes, id) {
  const byEra = pools(scenes);
  const all = [...new Set(Object.values(byEra).flatMap(s => [...s]))];
  const out = [];
  scenes[id - 1].lines.forEach((l, i) => {
    const ans = baseAuthor(l.author);
    if (ans === '佚名') return;
    const r = rng(hash(`${id}-${i + 1}`));
    const same = shuffle([...(byEra[l.era] || [])].filter(a => a !== ans), r);
    const rest = shuffle(all.filter(a => a !== ans && !same.includes(a)), r);
    const picks = [...same, ...rest].slice(0, 3);
    if (picks.length < 3) return;
    const options = shuffle([ans, ...picks], r);
    out.push({ k: i + 1, text: l.text, options, answer: options.indexOf(ans), source: l.source, era: l.era, gloss: l.gloss, author: l.author });
  });
  return out;
}
