import { todayIndex, parseDay, taipeiDateKey } from './day.js';
import { bgFor, setPageBg } from './cats.js';

const $ = (s, r = document) => r.querySelector(s);
const pad = n => String(n).padStart(3, '0');
const DONE_KEY = 'dq365.done';
const loadDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '[]'); } catch { return []; } };
const saveDone = a => { try { localStorage.setItem(DONE_KEY, JSON.stringify(a)); } catch {} };

const state = { scenes: [], id: 1, rate: 1, playing: false, resolve: null };

async function main() {
  state.scenes = await (await fetch('data/scenes.json')).json();
  state.id = parseDay(location.search) ?? todayIndex();
  render();
}

function scene() { return state.scenes[state.id - 1]; }

function render() {
  const x = scene();
  const today = todayIndex();
  document.title = `${x.title_zh} — 名句日日聽`;
  $('#dayLabel').textContent = state.id === today ? `今天 · 第 ${state.id} 天` : `第 ${state.id} 天`;
  $('#cat').textContent = x.category;
  setPageBg(bgFor(x.category));
  $('#titleZh').textContent = x.title_zh;
  $('#scene').textContent = x.intro_zh;
  const hero = $('#hero');
  hero.classList.remove('missing');
  const img = $('#heroImg');
  img.alt = x.title_zh;
  img.onerror = () => { hero.classList.add('missing'); img.style.display = 'none'; };
  img.style.display = '';
  img.src = `img/${pad(x.id)}.webp`;

  const ul = $('#lines'); ul.innerHTML = '';
  x.lines.forEach((l, k) => {
    const li = document.createElement('li');
    li.className = 'line hide-en hide-zh'; li.dataset.k = k + 1;
    li.innerHTML = `<button class="play" aria-label="播放第 ${k + 1} 句">▶</button>
      <div><span class="en"></span><span class="zh"><b class="who"></b><span class="gloss"></span></span></div>`;
    $('.en', li).textContent = l.text;
    $('.who', li).textContent = `${l.author}・${l.source}${l.era === '西方' ? '（譯句）' : ''}`;
    $('.gloss', li).textContent = l.gloss;
    $('.play', li).onclick = () => { stopAll(); playLine(k + 1); };
    $('.en', li).tabIndex = 0; $('.en', li).setAttribute('role','button');
    $('.en', li).onclick = $('.en', li).onkeydown = e => { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); li.classList.remove('hide-en'); };
    $('.zh', li).tabIndex = 0; $('.zh', li).setAttribute('role','button');
    $('.zh', li).onclick = $('.zh', li).onkeydown = e => { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); li.classList.remove('hide-en'); li.classList.remove('hide-zh'); };
    ul.appendChild(li);
  });
  $('#prev').disabled = state.id <= 1; $('#next').disabled = state.id >= 365;
  renderDone();
}

function renderDone() {
  const done = loadDone(); const key = taipeiDateKey();
  const btn = $('#doneBtn'); const isDone = done.includes(key);
  btn.classList.toggle('is-done', isDone); btn.textContent = isDone ? '✓ 今日已完成' : '完成今日';
  let streak = 0; const d = new Date();
  for (;;) { if (!done.includes(taipeiDateKey(d))) break; streak++; d.setDate(d.getDate() - 1); }
  $('#stats').textContent = `已練 ${done.length} 天 · 連續 ${streak} 天`;
}

const player = new Audio();
let session = 0;

function speakFallback(k, sid) {
  return new Promise(res => {
    if (!('speechSynthesis' in window) || sid !== session) return res();
    const u = new SpeechSynthesisUtterance(scene().lines[k - 1].text);
    u.lang = 'zh-TW'; u.rate = state.rate; u.onend = res; u.onerror = res;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  });
}

function playLine(k) {
  const sid = ++session;
  const li = $(`.line[data-k="${k}"]`);
  document.querySelectorAll('.line.playing').forEach(e => e.classList.remove('playing'));
  li && li.classList.add('playing');
  return new Promise(res => {
    let done = false;
    const finish = () => { if (done) return; done = true; li && li.classList.remove('playing'); if (state.resolve === finish) state.resolve = null; res(); };
    const fallback = () => { if (done || sid !== session) return finish(); speakFallback(k, sid).then(finish); };
    state.resolve = finish;
    player.onended = finish; player.onerror = fallback;
    player.src = `audio/${pad(state.id)}-${k}.mp3`; player.playbackRate = state.rate;
    player.play().catch(fallback);
  });
}

function stopAll() {
  state.playing = false; session++;
  player.onended = null; player.onerror = null; player.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (state.resolve) { const r = state.resolve; state.resolve = null; r(); }
  document.querySelectorAll('.line.playing').forEach(e => e.classList.remove('playing'));
  $('#playAll').textContent = '▶ 聽全部'; $('#playAll').classList.remove('primary');
}

async function playAll() {
  if (state.playing) return stopAll();
  state.playing = true; $('#playAll').textContent = '■ 停止'; $('#playAll').classList.add('primary');
  for (let k = 1; k <= 5 && state.playing; k++) {
    await playLine(k);
    if (state.playing && k < 5) await new Promise(r => setTimeout(r, 1200));
  }
  if (state.playing) stopAll();
}

function go(id) { history.pushState(null, '', `?d=${id}`); stopAll(); state.id = id; render(); window.scrollTo(0, 0); }

$('#playAll').onclick = playAll;
$('#showEn').onclick = () => document.querySelectorAll('.line').forEach(e => e.classList.remove('hide-en'));
$('#showZh').onclick = () => document.querySelectorAll('.line').forEach(e => { e.classList.remove('hide-en'); e.classList.remove('hide-zh'); });
$('#rate').onclick = e => { state.rate = state.rate === 1 ? 0.75 : 1; e.currentTarget.textContent = state.rate === 1 ? '1×' : '0.75× 慢速'; e.currentTarget.setAttribute('aria-pressed', state.rate !== 1); };
$('#prev').onclick = () => go(state.id - 1);
$('#next').onclick = () => go(state.id + 1);
$('#doneBtn').onclick = () => { const done = loadDone(); const key = taipeiDateKey(); if (!done.includes(key)) { done.push(key); saveDone(done); } renderDone(); };
window.addEventListener('popstate', () => { state.id = parseDay(location.search) ?? todayIndex(); stopAll(); render(); });

main().catch(e => { $('#titleZh').textContent = '載入失敗，請重新整理'; console.error(e); });
