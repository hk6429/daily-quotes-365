import { todayIndex, parseDay, taipeiDateKey } from './day.js';
import { bgFor, setPageBg } from './cats.js';
import { buildQuiz } from './quiz.js';
import { loadDone, markDone, doneDate, isDoneToday, streakInfo, practicedDays, earnedBadges, nextBadge, loadVoice, addVoice } from './progress.js';
import { STAGES, plan, total, initial, advance, needsAudio, progress, loadMission, saveMission } from './mission.js';
import { shareCard } from './share.js';
import { AUDIO_VERSION, FALLBACK_RATE, audioUrl, readingText, taiwanMaleVoice } from './audio-config.js';

// Google Fonts 標題字型：非阻塞載入（不用 inline 事件，才能上 CSP）
{ const f = document.createElement('link'); f.rel = 'stylesheet'; f.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@700&display=swap'; document.head.append(f); }

const $ = (s, r = document) => r.querySelector(s);
const pad = n => String(n).padStart(3, '0');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BIG_KEY = 'dq365.big', SEEN_KEY = 'dq365.seen';
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

const state = { scenes: [], readings: {}, id: 1, rate: 1, playing: false, resolve: null, touched: false };

async function main() {
  [state.scenes, state.readings] = await Promise.all([
    fetch('data/scenes.json').then(res => res.json()),
    fetch(`data/reading-overrides.json?v=${AUDIO_VERSION}`).then(res => res.ok ? res.json() : {}).catch(() => ({})),
  ]);
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
  closeQuiz(); closeMission();
  $('#prev').disabled = state.id <= 1; $('#next').disabled = state.id >= 365;
  renderDone();
  renderMissionBtn();
  prefetchDay();
}

const yesterdayKey = () => taipeiDateKey(new Date(Date.now() - 86400000));
const isYesterdayLesson = () => state.id === todayIndex() - 1;
const lessonDone = (list, id) => isDoneToday(list, id) || (isYesterdayLesson() && isDoneToday(list, id, yesterdayKey())); // 補課記在昨天

function renderDone() {
  const list = loadDone(); const x = scene();
  const done = lessonDone(list, x.id);
  const btn = $('#doneBtn');
  btn.classList.toggle('is-done', done); btn.textContent = done ? '✓ 已完成' : '完成這一課';
  const { streak: s, freezes } = streakInfo(list); const days = practicedDays(list), voice = loadVoice();
  $('#stats').innerHTML = `已練 <b>${days}</b> 天 · 連續 <b>${s}</b> 天${freezes ? ` · 保護卡 <b>${freezes}</b>` : ''}`;
  const y = $('#missed'); const today = taipeiDateKey();
  const backfill = `<a href="?d=${Math.max(1, todayIndex() - 1)}">補一課</a>`;
  y.hidden = !(list.length > 0 && !list.some(v => v.d === yesterdayKey()) && !list.some(v => v.d === today) && state.id === todayIndex());
  if (!y.hidden) y.innerHTML = s > 0 ? `昨天沒練到，保護卡先幫你保住連續 ${s} 天；${backfill}就能把卡省下來。` : `昨天沒練到？${backfill}，連續天數會接回來。`;
  renderBadges(days, voice);
  $('#shareBtn').hidden = !done;
  $('#stamp').classList.toggle('show', done);
  $('#stampSay').classList.toggle('show', loadMission(x.id).done);
}

// 里程碑：已得的印章＋下一枚目標；新得的那枚彈一下
function renderBadges(days, voice) {
  const got = earnedBadges(days, voice).map(b => b.label); const nb = nextBadge(days, voice);
  let seen = []; try { seen = JSON.parse(localStorage.getItem('dq365.badges') || '[]'); } catch {}
  const box = $('#badges');
  box.hidden = !got.length && !nb;
  box.innerHTML = got.map(l => `<span class="badge${seen.includes(l) ? '' : ' pop'}">${esc(l)}</span>`).join('')
    + (nb ? `<span class="badge-next">下一枚「${esc(nb.label)}」${esc(nb.left)}</span>` : '<span class="badge-next">全部收齊！</span>');
  lsSet('dq365.badges', JSON.stringify(got));
}
function complete(id) { markDone(id, doneDate(loadDone(), isYesterdayLesson())); renderDone(); }

const player = new Audio();
let session = 0;

function speakFallback(k, sid) {
  return new Promise(res => {
    if (!('speechSynthesis' in window) || sid !== session) return res();
    const u = new SpeechSynthesisUtterance(readingText(state.readings, state.id, k, scene().lines[k - 1].text));
    u.lang = 'zh-TW'; u.rate = FALLBACK_RATE * state.rate; u.onend = res; u.onerror = res;
    const voice = taiwanMaleVoice(speechSynthesis.getVoices());
    if (voice) u.voice = voice;
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
    player.src = audioUrl(state.id, k); player.playbackRate = state.rate;
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
$('#doneBtn').onclick = () => { if (!state.touched && !lessonDone(loadDone(), scene().id)) { $('#stats').textContent = '先聽一聽或看看答案，再按完成喔'; return; } complete(scene().id); };
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
  closeMission(); quiz.qs = buildQuiz(state.scenes, state.id); quiz.i = 0; quiz.score = 0;
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

// ── 今日口說任務（四關背誦；不用麥克風，學習者念完自己按「念完了」）──
const MISSION_LABEL = '今日口說任務（四關背誦）';
const ms = { st: null, check: false, hint: 0 };
const missionOpen = () => !$('#mission').hidden;
const MSG = {
  1: '看著原句和白話，跟著原音一起念。',
  2: '只看原句，聽完原音後自己念。',
  3: '字遮起來了，聽完原音後自己念。',
  4: '不看字、不放原音，把這句背出來。',
};
const FOOT = {
  1: '五句輪流念：原音播完才能按「念完了」，跟著原音同步念。',
  2: '五句輪流念：第一輪先播原音，之後看著原句自己念；念不順就按「再聽一次」。',
  3: '憑耳朵記憶念出來；按「念完了」會揭曉原句並播原音讓你對照。',
  4: '卡住可以按「提示」；按「念完了」會揭曉原句並播原音讓你對照。',
};
const whoOf = l => `${l.author === '佚名' ? '' : l.author + '・'}${l.source}`;
// 第 1 次提示給白話，第 2 次再給原句開頭兩個字
const hintText = (l, h) => h >= 2 ? `${esc(l.gloss)}<br>${esc(l.text.slice(0, 2))} …` : esc(l.gloss);

function renderMissionBtn() {
  const b = $('#missionBtn'); if (missionOpen()) return;
  b.textContent = loadMission(scene().id).done ? '✓ 口說任務完成' : MISSION_LABEL;
}
function closeMission() {
  const box = $('#mission'); if (box.hidden) return;
  stopAll();
  box.hidden = true; box.innerHTML = '';
  $('#lines').hidden = false; $('.controls').hidden = false;
  const b = $('#missionBtn'); b.setAttribute('aria-expanded', 'false'); renderMissionBtn();
}
function openMission() {
  stopAll(); closeQuiz(); state.touched = true;
  ms.st = loadMission(scene().id); ms.check = false; ms.hint = 0;
  if (!ms.st.done && progress(ms.st) === 0 && new URLSearchParams(location.search).get('mission') === 'lite') ms.st = initial(true); // 老師可用 ?mission=lite 讓全班做輕量版
  $('#lines').hidden = true; $('.controls').hidden = true; $('#mission').hidden = false;
  const b = $('#missionBtn'); b.setAttribute('aria-expanded', 'true'); b.textContent = '離開口說任務（進度會保留）';
  renderMission(true);
  $('#mission').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
// 按鈕至少鎖 1.2 秒（防連點）；有播原音就等原音播完才解鎖，原音卡住最多等 6 秒
function lockUntil(btn, audio) {
  btn.disabled = true;
  const t0 = Date.now(); let open = false;
  const unlock = () => { if (open) return; open = true; setTimeout(() => { btn.disabled = false; }, Math.max(0, 1200 - (Date.now() - t0))); };
  if (audio) { audio.then(unlock); setTimeout(unlock, 6000); } else unlock();
}
// autoplay：這一次需要原音時自動播（開啟面板或按鈕的點擊當下觸發，iOS 才放行）
// 關三、關四按「念完了」先進入對照（揭曉原句＋播原音），自評念對了才計次
function renderMission(autoplay) {
  const box = $('#mission'); const st = ms.st; const x = scene();
  const S = STAGES[st.stage - 1]; const l = x.lines[st.k - 1];
  const P = plan(st.lite), N = total(st.lite), pct = Math.round(progress(st) / N * 100);
  const stages = STAGES.filter(s => P.stages.includes(s.n)).map(s => `<li data-s="${s.n}" class="${st.done || s.n < st.stage ? 'ok' : s.n === st.stage ? 'on' : ''}">${st.done || s.n < st.stage ? '✓' : s.n}</li>`).join('');
  if (st.done) {
    box.innerHTML = `<ol class="m-stages">${stages}</ol><div class="m-seal" aria-hidden="true">說</div><p class="m-done">✓ 口說任務完成</p><p class="m-sub">${N} 次開口全數完成，也算完成這一課！</p>`;
    return;
  }
  const dots = '●'.repeat(st.k - 1) + '○'.repeat(5 - st.k + 1); // 這一輪念到第幾句
  const where = `第 ${st.n + 1} / ${P.reps} 輪　${dots}`;
  const mode = progress(st) === 0 ? `<button class="m-mode" type="button">${st.lite ? '改完整版（100 次，約 12 分鐘）' : '時間不多？改輕量版（30 次，約 4 分鐘）'}</button>` : '';
  const showText = S.text || ms.check, showGloss = S.gloss || (ms.check && st.stage === 4);
  const hint = !ms.check && st.stage === 4 && ms.hint ? `<div class="m-hint">${hintText(l, ms.hint)}</div>` : '';
  const act = ms.check
    ? '<button class="m-again" type="button">↻ 沒念對，再一次</button><button class="m-ok" type="button">✓ 念對了</button>'
    : (S.audio === 'none' ? `<button class="m-tip" type="button"${ms.hint >= 2 ? ' disabled' : ''}>💡 提示</button>` : '<button class="m-hear" type="button">▶ 再聽一次</button>')
      + '<button class="m-manual" type="button">✓ 念完了</button>';
  box.innerHTML = `<ol class="m-stages">${stages}</ol>
    <p class="m-name">第${'一二三四'[st.stage - 1]}關：${esc(S.name)}</p>
    <div class="m-line${ms.check ? ' checking' : ''}"><span class="spk">第 ${st.k} 句${showText ? `・${esc(whoOf(l))}` : ''}</span>
      ${showText ? `<div class="m-text">${esc(l.text)}</div>` : '<div class="m-text masked">‧‧‧‧‧‧</div>'}
      ${showGloss ? `<div class="m-zh">${esc(l.gloss)}</div>` : ''}${hint}</div>
    <p class="m-where">${where}</p>
    <p class="m-count">總進度 ${progress(st)} / ${N}　第 ${st.k} 句</p>
    <div class="m-bar"><i style="width:${pct}%"></i></div>
    <p class="m-msg" aria-live="polite">${ms.check ? '對照一下：剛剛念的跟原句一樣嗎？' : MSG[st.stage]}</p>
    <div class="m-act">${act}</div>
    <p class="hint-inline">${ms.check ? '念對了才計一次；沒念對就再念一次，不扣進度。' : FOOT[st.stage]}</p>${mode}`;
  const next = () => {
    stopAll(); ms.check = false; ms.hint = 0; ms.st = advance(ms.st); saveMission(x.id, ms.st); addVoice();
    if (ms.st.done) complete(x.id); // 口說任務全過也算完成這一課
    renderMission(true); renderMissionBtn(); renderDone();
  };
  const md = $('.m-mode', box); if (md) md.onclick = () => { stopAll(); ms.st = initial(!st.lite); saveMission(x.id, ms.st); renderMission(true); };
  const hear = $('.m-hear', box); if (hear) hear.onclick = () => { stopAll(); playLine(st.k); };
  const tip = $('.m-tip', box); if (tip) tip.onclick = () => { ms.hint++; renderMission(false); };
  const again = $('.m-again', box); if (again) again.onclick = () => { stopAll(); ms.check = false; renderMission(false); };
  const ok = $('.m-ok', box);
  if (ok) { ok.onclick = next; lockUntil(ok, autoplay ? playLine(st.k) : null); return; }
  const man = $('.m-manual', box);
  man.onclick = () => { if (st.stage >= 3) { stopAll(); ms.check = true; renderMission(true); } else next(); };
  lockUntil(man, autoplay && needsAudio(st) ? playLine(st.k) : null);
}
$('#missionBtn').onclick = () => (missionOpen() ? closeMission() : openMission());

$('#shareBtn').onclick = () => {
  const x = scene(); const list = loadDone();
  const sub = x.intro_zh.length > 20 ? x.intro_zh.slice(0, 19) + '…' : x.intro_zh;
  shareCard({ id3: pad(x.id), day: state.id, date: taipeiDateKey(), titleZh: x.title_zh, sub,
    streak: streakInfo(list).streak, days: practicedDays(list), voice: loadVoice(), said: loadMission(x.id).done });
};

// ── 課堂模式：全螢幕大字，每句依序「聽 → 原句 → 出處 → 白話」，空白鍵／點一下往下一步 ──
const stage = { k: 1, step: 0, open: false };
const stageEnd = () => stage.k > 5;

function stageRender() {
  const body = $('#stBody'); body.innerHTML = '';
  const x = scene();
  $('#stInfo').textContent = `${x.title_zh}　第 ${state.id} 天` + (stageEnd() ? '' : `　第 ${stage.k} / 5 句`);
  if (stageEnd()) {
    body.append(el('p', 'st-text', '今天 5 句完成'), el('p', 'st-hint', '空白鍵重來，Esc 離開'));
    state.touched = true; return;
  }
  const l = x.lines[stage.k - 1];
  if (stage.step === 0) body.append(el('p', 'st-q', '？'), el('p', 'st-hint', '先聽，猜猜是誰說的（空白鍵揭曉原句）'));
  else {
    body.append(el('p', 'st-text', l.text));
    if (stage.step >= 2) body.append(el('p', 'st-who', `${l.author === '佚名' ? '' : l.author + '・'}${l.source}`));
    if (stage.step >= 3) body.append(el('p', 'st-gloss', l.gloss));
  }
  if (stage.step === 0) { stopAll(); playLine(stage.k); }
}

function stageNext() {
  if (stageEnd()) { stage.k = 1; stage.step = 0; }
  else if (stage.step < 3) stage.step++;
  else { stage.k++; stage.step = 0; }
  stageRender();
}
function stagePrev() {
  if (stageEnd()) { stage.k = 5; stage.step = 3; }
  else if (stage.step > 0) stage.step--;
  else if (stage.k > 1) { stage.k--; stage.step = 3; }
  stageRender();
}
function stageOpen() {
  stopAll(); closeQuiz(); closeMission(); stage.k = 1; stage.step = 0; stage.open = true;
  $('#stage').hidden = false; $('#stage').focus();
  const r = document.documentElement.requestFullscreen; if (r) r.call(document.documentElement).catch(() => {});
  stageRender();
}
function stageClose() {
  stopAll(); stage.open = false; $('#stage').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  $('#stageBtn').focus();
}
$('#stageBtn').onclick = stageOpen;
$('#stNext').onclick = stageNext; $('#stPrev').onclick = stagePrev; $('#stExit').onclick = stageClose;
$('#stPlay').onclick = () => { if (!stageEnd()) { stopAll(); playLine(stage.k); } };
$('#stBody').onclick = stageNext;
document.addEventListener('keydown', e => {
  if (!stage.open || e.ctrlKey || e.metaKey || e.altKey) return;
  const onBtn = e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter'); // 按鈕自己的鍵盤啟動不攔
  if (onBtn) return;
  const map = { ' ': stageNext, ArrowRight: stageNext, ArrowLeft: stagePrev, Escape: stageClose, p: () => $('#stPlay').click(), P: () => $('#stPlay').click() };
  if (map[e.key]) { e.preventDefault(); map[e.key](); }
});

// ── 離線：註冊 Service Worker，並預載目前這天與隔天的圖與 5 句音檔 ──
function prefetchDay() {
  if (!navigator.onLine || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  const urls = [state.id, state.id + 1].filter(i => i <= 365).flatMap(i => [`img/${pad(i)}.webp`, ...[1, 2, 3, 4, 5].map(k => audioUrl(i, k))]);
  (window.requestIdleCallback || setTimeout)(() => urls.forEach(u => fetch(u).catch(() => {})));
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(prefetchDay).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', prefetchDay);
}
