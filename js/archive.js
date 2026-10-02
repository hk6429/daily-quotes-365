import { todayIndex } from './day.js';
import { bgFor, setPageBg } from './cats.js';
import { doneIds } from './progress.js';
setPageBg('bg/generic.webp');
const scenes = await (await fetch('data/scenes.json')).json();
const today = todayIndex();
const owned = doneIds();
let total = 0;
const groups = new Map();
for (const x of scenes) { if (!groups.has(x.category)) groups.set(x.category, []); groups.get(x.category).push(x); }
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
const root = document.getElementById('groups');
for (const [cat, list] of groups) {
  const g = el('section', 'group');
  const got = list.filter(x => owned.has(x.id)).length; total += got;
  const h = el('h2', '', cat); h.append(el('small', '', `已收 ${got} / ${list.length}`));
  const meter = el('span', 'meter'); const bar = el('i'); bar.style.width = `${Math.round(got / list.length * 100)}%`; meter.append(bar); h.append(meter);
  const banner = el('div', 'banner'); banner.append(h);
  banner.style.backgroundImage = `url("${bgFor(cat)}")`;
  const grid = el('div', 'grid');
  for (const x of list) {
    const own = owned.has(x.id); // 沒練過就保留懸念：名稱遮住、上色要練完
    const a = el('a', (x.id === today ? 'today' : '') + (own ? ' is-done' : '')); a.href = `./?d=${x.id}`;
    const thumb = el('span', 'thumb');
    const img = new Image(); img.loading = 'lazy'; img.alt = '';
    img.addEventListener('error', () => { thumb.classList.add('missing'); img.remove(); });
    img.src = `img/t/${String(x.id).padStart(3, '0')}.webp`;
    thumb.append(img);
    const txt = el('span', 'txt');
    txt.append(el('small', '', `第 ${x.id} 天`), el('b', '', own ? x.title_zh : '？？？'), el('i', '', own ? x.lines[0].author + ' 等' : '練完揭曉'));
    a.append(thumb, txt); grid.append(a);
  }
  g.append(banner, grid); root.append(g);
}
document.getElementById('collected').textContent = `目前已收集 ${total} / ${scenes.length}。`;
