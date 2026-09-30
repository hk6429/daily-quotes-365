// 每日 5 題：作者夠常見的句子考「出自誰」（四選一，全是人名，同時代優先），其餘（佚名、冷僻作者、書名）改考「白話意思」。
// 純函式，瀏覽器與 Node 共用。
export const baseAuthor = a => a.replace(/（.*$/, '').replace(/^(傳為|舊題|傳)/, '').replace(/[・．]/g, '‧').trim();

const MIN_LINES = 3; // 作者至少出現這麼多句才算「常見」，才會當答案或干擾項
const isPerson = a => a !== '佚名' && !/^[《〈]/.test(a);

const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const rng = seed => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (a, r) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

let poolCache = null, poolFor = null;
function pools(scenes) {
  if (poolFor === scenes) return poolCache;
  const count = {}, eraOf = {};
  for (const s of scenes) for (const l of s.lines) {
    const a = baseAuthor(l.author);
    if (!isPerson(a)) continue;
    count[a] = (count[a] || 0) + 1; eraOf[a] = eraOf[a] || l.era;
  }
  const byEra = {}, known = new Set();
  for (const a in count) if (count[a] >= MIN_LINES) { known.add(a); (byEra[eraOf[a]] = byEra[eraOf[a]] || new Set()).add(a); }
  const glossByCat = {};
  for (const s of scenes) (glossByCat[s.category] = glossByCat[s.category] || []).push(...s.lines.map(l => l.gloss));
  poolFor = scenes; poolCache = { byEra, known, glossByCat, allGloss: scenes.flatMap(s => s.lines.map(l => l.gloss)) };
  return poolCache;
}

export function buildQuiz(scenes, id) {
  const { byEra, known, glossByCat, allGloss } = pools(scenes);
  const scene = scenes[id - 1];
  return scene.lines.map((l, i) => {
    const r = rng(hash(`${id}-${i + 1}`));
    const base = { k: i + 1, text: l.text, source: l.source, era: l.era, gloss: l.gloss, author: l.author };
    const ans = baseAuthor(l.author);
    if (known.has(ans)) {
      const same = shuffle([...(byEra[l.era] || [])].filter(a => a !== ans), r);
      const rest = shuffle([...known].filter(a => a !== ans && !same.includes(a)), r);
      const options = shuffle([ans, ...[...same, ...rest].slice(0, 3)], r);
      return { ...base, type: 'author', options, answer: options.indexOf(ans) };
    }
    const bad = g => g !== l.gloss;
    const near = shuffle([...new Set(glossByCat[scene.category])].filter(bad), r);
    const far = shuffle([...new Set(allGloss)].filter(g => bad(g) && !near.includes(g)), r);
    const options = shuffle([l.gloss, ...[...near, ...far].slice(0, 3)], r);
    return { ...base, type: 'meaning', options, answer: options.indexOf(l.gloss) };
  });
}
