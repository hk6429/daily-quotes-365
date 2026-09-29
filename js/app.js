import { todayIndex, parseDay, taipeiDateKey } from './day.js';
import { bgFor, setPageBg } from './cats.js';
import { buildQuiz } from './quiz.js';

const $ = (s, r = document) => r.querySelector(s);
const pad = n => String(n).padStart(3, '0');
const DONE_KEY = 'dq365.done';
const loadDone = () => { try { const a = JSON.parse(localStorage.getItem(DONE_KEY) || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; } catch { return []; } };
const BIG_KEY = 'dq365.big', SEEN_KEY = 'dq365.seen';
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const saveDone = a => { try { localStorage.setItem(DONE_KEY, JSON.stringify(a)); } catch {} };

const state = { scenes: [], id: 1, rate: 1, playing: false, resolve: null, touched: false };

async function main() {
  state.scenes = await (await fetch('data/scenes.json')).json();
  state.id = parseDay(location.search) ?? todayIndex();
  render();
}

function scene() { return state.scenes[state.id - 1]; }

const HIDE = { en: ['hide-en', '揭曉原句'], zh: ['hide-zh', '揭曉出處與釋義'] };
function mask(li, part) {
  const e = $(`.${part}`, li);
  li.classList.add(HIDE[part][0]);
  e.tabIndex = 0; e.setAttribute('role', 'button'); e.setAttribute('aria-label', HIDE[part][1]);
}
function reveal(li, part) {
  const e = $(`.${part}`, li);
  li.classList.remove(HIDE[part][0]);
  e.removeAttribute('aria-label'); e.removeAttribute('role'); e.removeAttribute('tabindex');
  state.touched = true;
}
const revealAll = (parts) => document.querySelectorAll('.line').forEach(li => parts.forEach(p => reveal(li, p)));

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
    li.className = 'line'; li.dataset.k = k + 1;
    li.innerHTML = `<button class="play" aria-label="播放第 ${k + 1} 句">▶</button>
      <div><span class="en"></span><span class="zh"><b class="who"></b><span class="gloss"></span></span></div>`;
    $('.en', li).textContent = l.text;
    $('.who', li).textContent = `${l.author === '佚名' ? '' : l.author + '・'}${l.source}${l.era === '西方' && !l.source.includes('自譯') ? '（譯句）' : ''}`;
    $('.gloss', li).textContent = l.gloss;
    $('.play', li).onclick = () => { state.touched = true; stopAll(); playLine(k + 1); };
    mask(li, 'en'); mask(li, 'zh');
    $('.en', li).onclick = $('.en', li).onkeydown = e => { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); reveal(li, 'en'); };
    $('.zh', li).onclick = $('.zh', li).onkeydown = e => { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); reveal(li, 'en'); reveal(li, 'zh'); };
    ul.appendChild(li);
  });
  state.touched = false;
  closeQuiz();
  $('#quizBtn').hidden = buildQuiz(state.scenes, state.id).length === 0;
  $('#prev').disabled = state.id <= 1; $('#next').disabled = state.id >= 365;
  renderDone();
}

function renderDone() {
  const done = loadDone(); const key = taipeiDateKey();
  const btn = $('#doneBtn'); const isDone = done.includes(key);
  btn.classList.toggle('is-done', isDone); btn.textContent = isDone ? '✓ 今日已完成' : '今天練完了';
  let streak = 0; const d = new Date();
  if (!isDone) d.setTime(d.getTime() - 86400000); // 今天還沒練：連續天數先算到昨天，不歸零
  for (;;) { if (!done.includes(taipeiDateKey(d))) break; streak++; d.setTime(d.getTime() - 86400000); }
  $('#stats').textContent = `已練 ${done.length} 天 · 連續 ${streak} 天${!isDone && streak ? '（今天還沒練）' : ''}`;
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
    let fell = false;
    const fallback = () => { if (fell) return; fell = true; if (done || sid !== session) return finish(); speakFallback(k, sid).then(finish); };
    state.resolve = finish;
    player.onended = finish; player.onerror = fallback;
    player.src = `audio/${pad(state.id)}-${k}.mp3?v=2`; player.playbackRate = state.rate;
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

function go(id) {
  history.pushState(null, '', `?d=${id}`); stopAll(); state.id = id; render(); window.scrollTo(0, 0);
  if (id >= 365) $('#prev').focus(); else if (id <= 1) $('#next').focus();
}

$('#playAll').onclick = playAll;
$('#showEn').onclick = () => revealAll(['en']);
$('#showZh').onclick = () => revealAll(['en', 'zh']);
$('#rate').onclick = e => { state.rate = state.rate === 1 ? 0.75 : 1; player.playbackRate = state.rate; e.currentTarget.textContent = state.rate === 1 ? '語速 1×' : '語速 慢'; e.currentTarget.setAttribute('aria-pressed', state.rate !== 1); };
$('#prev').onclick = () => go(state.id - 1);
$('#next').onclick = () => go(state.id + 1);
$('#doneBtn').onclick = () => { if (!state.touched && !loadDone().includes(taipeiDateKey())) { $('#stats').textContent = '先聽一聽或看看答案，再按完成喔'; return; } const done = loadDone(); const key = taipeiDateKey(); if (!done.includes(key)) { done.push(key); saveDone(done); } renderDone(); };
window.addEventListener('popstate', () => { state.id = parseDay(location.search) ?? todayIndex(); stopAll(); render(); });

const setBig = on => { document.documentElement.classList.toggle('big', on); $('#zoom').setAttribute('aria-pressed', on); };
setBig(lsGet(BIG_KEY) === '1');
$('#zoom').onclick = () => { const on = !document.documentElement.classList.contains('big'); setBig(on); lsSet(BIG_KEY, on ? '1' : '0'); };
const howto = $('#howto');
if (lsGet(SEEN_KEY)) howto.removeAttribute('open');
howto.addEventListener('toggle', () => { if (!howto.open) lsSet(SEEN_KEY, '1'); });

main().catch(e => {
  $('#titleZh').textContent = '載入失敗';
  const b = document.createElement('button'); b.textContent = '重試'; b.onclick = () => location.reload();
  $('#scene').textContent = ''; $('#scene').append(b); console.error(e);
});

// ── 猜作者小測驗 ──
const QUIZ_KEY = 'dq365.quiz';
const quizBest = () => { try { const o = JSON.parse(lsGet(QUIZ_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
const saveQuizBest = n => { const o = quizBest(); const k = taipeiDateKey(); o[k] = Math.max(o[k] || 0, n); lsSet(QUIZ_KEY, JSON.stringify(o)); };
const quiz = { qs: [], i: 0, score: 0 };

function closeQuiz() {
  const box = $('#quiz'); if (!box) return;
  box.hidden = true; box.innerHTML = '';
  $('#lines').hidden = false;
  $('#quizBtn').setAttribute('aria-expanded', 'false');
}

function openQuiz() {
  quiz.qs = buildQuiz(state.scenes, state.id); quiz.i = 0; quiz.score = 0;
  stopAll(); state.touched = true;
  $('#lines').hidden = true; $('#quiz').hidden = false;
  $('#quizBtn').setAttribute('aria-expanded', 'true');
  showQuestion();
}

function showQuestion() {
  const box = $('#quiz'); const q = quiz.qs[quiz.i]; box.innerHTML = '';
  const h = document.createElement('div'); h.className = 'q-head';
  h.textContent = `第 ${quiz.i + 1} / ${quiz.qs.length} 題　答對 ${quiz.score}`;
  const play = document.createElement('button'); play.className = 'q-play'; play.textContent = '▶ 聽這句';
  play.onclick = () => { stopAll(); playLine(q.k); };
  const t = document.createElement('p'); t.className = 'q-text'; t.textContent = q.text;
  const ask = document.createElement('p'); ask.className = 'q-ask'; ask.textContent = '這句話出自誰？';
  const opts = document.createElement('div'); opts.className = 'q-opts';
  const fb = document.createElement('div'); fb.className = 'q-fb'; fb.setAttribute('aria-live', 'polite');
  q.options.forEach((name, n) => {
    const b = document.createElement('button'); b.textContent = name;
    b.onclick = () => {
      opts.querySelectorAll('button').forEach(x => x.disabled = true);
      const ok = n === q.answer; if (ok) quiz.score++;
      b.classList.add(ok ? 'right' : 'wrong'); opts.children[q.answer].classList.add('right');
      fb.innerHTML = '';
      const r = document.createElement('p'); r.className = 'q-res'; r.textContent = ok ? '答對了！' : `答案是 ${q.options[q.answer]}`;
      const w = document.createElement('p'); w.className = 'q-who'; w.textContent = `${q.author === '佚名' ? '' : q.author + '・'}${q.source}`;
      const g = document.createElement('p'); g.className = 'q-gloss'; g.textContent = q.gloss;
      const nx = document.createElement('button'); nx.className = 'q-next';
      nx.textContent = quiz.i + 1 < quiz.qs.length ? '下一題' : '看成績';
      nx.onclick = () => { quiz.i++; quiz.i < quiz.qs.length ? showQuestion() : showResult(); };
      fb.append(r, w, g, nx); nx.focus();
    };
    opts.appendChild(b);
  });
  box.append(h, play, t, ask, opts, fb);
}

function showResult() {
  saveQuizBest(quiz.score);
  const box = $('#quiz'); box.innerHTML = '';
  const n = quiz.qs.length; const best = quizBest()[taipeiDateKey()] || quiz.score;
  const h = document.createElement('p'); h.className = 'q-score'; h.textContent = `答對 ${quiz.score} / ${n}`;
  const s = document.createElement('p'); s.className = 'q-gloss'; s.textContent = `今日最佳 ${best} / ${n}${quiz.score === n ? '　全對！' : ''}`;
  const again = document.createElement('button'); again.textContent = '再玩一次'; again.onclick = openQuiz;
  const back = document.createElement('button'); back.className = 'q-next'; back.textContent = '回到練習'; back.onclick = closeQuiz;
  box.append(h, s, again, back); back.focus();
}

$('#quizBtn').onclick = () => ($('#quiz').hidden ? openQuiz() : closeQuiz());

// ── 離線：註冊 Service Worker，並預載目前這天的 5 句音檔與圖 ──
function prefetchDay() {
  if (!navigator.onLine) return;
  const id = pad(state.id);
  const urls = [`img/${id}.webp`, ...[1, 2, 3, 4, 5].map(k => `audio/${id}-${k}.mp3?v=2`)];
  (window.requestIdleCallback || setTimeout)(() => urls.forEach(u => fetch(u).catch(() => {})));
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(prefetchDay).catch(() => {});
}
