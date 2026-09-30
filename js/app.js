import { todayIndex, parseDay, taipeiDateKey } from './day.js';
import { bgFor, setPageBg } from './cats.js';
import { buildQuiz } from './quiz.js';

// Google Fonts 標題字型：非阻塞載入（不用 inline 事件，才能上 CSP）
{ const f = document.createElement('link'); f.rel = 'stylesheet'; f.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@700&display=swap'; document.head.append(f); }

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
  $('#prev').disabled = state.id <= 1; $('#next').disabled = state.id >= 365;
  renderDone();
  prefetchDay();
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

// ── 每日小測驗（猜作者／猜意思） ──
const QUIZ_KEY = 'dq365.quiz';
const quizBest = () => { try { const o = JSON.parse(lsGet(QUIZ_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } };
const saveQuizBest = (id, n) => { const o = quizBest(); o[id] = { s: Math.max(Number(o[id] && o[id].s) || 0, n), n: quiz.qs.length }; lsSet(QUIZ_KEY, JSON.stringify(o)); };
const quiz = { qs: [], i: 0, score: 0 };
const QUIZ_BTN = '每日小測驗';

function closeQuiz(refocus) {
  const box = $('#quiz'); if (!box) return;
  box.hidden = true; box.innerHTML = '';
  $('#lines').hidden = false;
  const btn = $('#quizBtn'); btn.setAttribute('aria-expanded', 'false'); btn.textContent = QUIZ_BTN;
  if (refocus) btn.focus();
}

function openQuiz() {
  quiz.qs = buildQuiz(state.scenes, state.id); quiz.i = 0; quiz.score = 0;
  stopAll(); state.touched = true;
  $('#lines').hidden = true; $('#quiz').hidden = false;
  const btn = $('#quizBtn'); btn.setAttribute('aria-expanded', 'true'); btn.textContent = '結束測驗';
  showQuestion();
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

function showQuestion() {
  stopAll();
  const box = $('#quiz'); const q = quiz.qs[quiz.i]; box.innerHTML = '';
  box.style.pointerEvents = 'none'; setTimeout(() => { box.style.pointerEvents = ''; }, 350); // 防雙擊「下一題」誤答新題
  const isAuthor = q.type === 'author';
  const h = el('div', 'q-head', `第 ${quiz.i + 1} / ${quiz.qs.length} 題　答對 ${quiz.score}`);
  const play = el('button', 'q-play', '▶ 聽這句');
  play.onclick = () => { stopAll(); playLine(q.k); };
  const t = el('p', 'q-text', q.text); t.tabIndex = -1;
  const ask = el('p', 'q-ask', isAuthor ? `這句話出自誰？（時代：${q.era}）` : '這句話是什麼意思？');
  const opts = el('div', isAuthor ? 'q-opts' : 'q-opts long');
  const fb = el('div', 'q-fb'); fb.setAttribute('role', 'status');
  q.options.forEach((name, n) => {
    const b = el('button', '', name);
    b.onclick = () => {
      opts.querySelectorAll('button').forEach(x => x.disabled = true);
      const ok = n === q.answer; if (ok) quiz.score++;
      const right = opts.children[q.answer];
      b.classList.add(ok ? 'right' : 'wrong'); right.classList.add('right');
      b.textContent = `${ok ? '✓' : '✗'} ${name}`; if (!ok) right.textContent = `✓ ${right.textContent}`;
      const r = el('p', 'q-res', ok ? '答對了！' : isAuthor ? `差一點！答案是 ${q.options[q.answer]}` : '差一點！正確意思已標成綠色');
      const w = el('p', 'q-who', `${q.author === '佚名' ? '' : q.author + '・'}${q.source}`);
      const nx = el('button', 'q-next', quiz.i + 1 < quiz.qs.length ? '下一題' : '看成績');
      nx.onclick = () => { quiz.i++; quiz.i < quiz.qs.length ? showQuestion() : showResult(); };
      fb.append(r, w, ...(isAuthor ? [el('p', 'q-gloss', q.gloss)] : []), nx);
      setTimeout(() => nx.focus(), 400); // 稍後再移焦點，讓螢幕閱讀器先念完結果
    };
    opts.appendChild(b);
  });
  box.append(h, play, t, ask, opts, fb);
  t.focus({ preventScroll: true });
}

function showResult() {
  stopAll();
  saveQuizBest(state.id, quiz.score);
  const box = $('#quiz'); box.innerHTML = '';
  const n = quiz.qs.length; const best = quizBest()[state.id].s;
  const cheer = quiz.score === n ? '全對！' : quiz.score >= n - 2 ? '很不錯，再玩一次就全對。' : '再聽一次就會了，加油。';
  const h = el('p', 'q-score', `答對 ${quiz.score} / ${n}`); h.tabIndex = -1;
  const s = el('p', 'q-gloss', `這一天的最佳成績 ${best} / ${n}　${cheer}`);
  const again = el('button', '', '再玩一次'); again.onclick = openQuiz;
  const back = el('button', 'q-next', '回到練習'); back.onclick = () => closeQuiz(true);
  box.append(h, s, again, back); h.focus({ preventScroll: true });
}

$('#quizBtn').onclick = () => ($('#quiz').hidden ? openQuiz() : closeQuiz(true));

// ── 離線：註冊 Service Worker，並預載目前這天與隔天的圖與 5 句音檔 ──
function prefetchDay() {
  if (!navigator.onLine || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  const urls = [state.id, state.id + 1].filter(i => i <= 365).flatMap(i => [`img/${pad(i)}.webp`, ...[1, 2, 3, 4, 5].map(k => `audio/${pad(i)}-${k}.mp3?v=2`)]);
  (window.requestIdleCallback || setTimeout)(() => urls.forEach(u => fetch(u).catch(() => {})));
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(prefetchDay).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', prefetchDay);
}
