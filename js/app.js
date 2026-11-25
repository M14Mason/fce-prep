/* FCE Prep: vanilla JS, no build step. State lives in localStorage (key fce.v1). */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DAY = 864e5;
const dkey = (d = new Date()) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const monday = d => { const x = startOfDay(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; };
const fmtMin = m => m >= 60 ? (Math.floor(m / 60) + 'h ' + (Math.round(m % 60) ? Math.round(m % 60) + 'm' : '')).trim() : Math.round(m) + 'm';
const money = v => '$' + Math.round(v).toLocaleString();
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- state ---------- */
const KEY = 'fce.v1';
const DEFAULT = () => ({
  v: 1, created: Date.now(), updated: Date.now(),
  settings: { eventDate: '2027-01-09', hMin: 4, hMax: 7, name: 'Mason', apiKey: '', model: 'claude-sonnet-5-5', voice: false, narrate: false, gistToken: '', gistId: '', autoSync: false, examMinPerQ: 0.6 },
  startWeek: monday(new Date()).getTime(),
  log: {},            // { 'YYYY-MM-DD': { learn: sec, exam: sec, pitch: sec, other: sec } }
  tasks: {},          // { 'w0t3': doneTimestamp }
  custom: [],         // [{id, t, min, cat, date, done}]
  m: {},              // concept mastery { c: { s, ok, no, last } }
  qs: {},             // question stats { id: { ok, no } }
  notebook: {},       // missed question ids
  lessons: {},        // lessonId: completedTs
  cards: {},          // idx: { due, iv, ef, n }
  newCardsDay: { d: '', n: 0 },
  pitch: { firm: '', persona: '', opening: '', needs: '', value: '', solution: '', close: '', notes: '' },
  scores: [],         // [{ ts, src, s: { opening.. } , total }]
  runs: [],           // [{ ts, sec }]
  exams: [],          // [{ ts, n, ok, by: { IA: [ok, n] } }]
  aiQs: [], deckRuns: [], versions: [], pi: {}, daily: {}, speedBest: 0, matchBest: 0, deckTheme: 'navy-gold',
  chats: [],
  weekTargets: {}     // weekIndex: minutes
});
let S;
function load() {
  try { S = Object.assign(DEFAULT(), JSON.parse(localStorage.getItem(KEY) || '{}')); S.settings = Object.assign(DEFAULT().settings, S.settings); S.pitch = Object.assign(DEFAULT().pitch, S.pitch); }
  catch (e) { S = DEFAULT(); }
}
let saveT, syncT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    S.updated = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('⚠️ Storage full. Export a sync code now.'); }
    if (S.settings.autoSync && S.settings.gistToken) { clearTimeout(syncT); syncT = setTimeout(() => gistPush(true), 15000); }
  }, 250);
}
load();
const allQs = () => QUESTIONS.concat(S.aiQs || []);

/* ---------- ui helpers ---------- */
function toast(t, ms = 2600) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), ms); }
function modal(html, onMount) {
  const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="box">${html}</div>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  function close() { m.remove(); document.removeEventListener('keydown', esck); }
  function esck(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', esck);
  document.body.appendChild(m); onMount && onMount(m, close); return close;
}
function confirm2(title, text, cb) { // two confirmations for anything destructive
  modal(`<h3 style="margin-bottom:8px">⚠️ ${esc(title)}</h3><p class="muted small">${esc(text)}</p><div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn danger" id="c1">Yes, continue</button></div>`, (m, close) => {
    $('#c1', m).onclick = () => { close(); modal(`<h3 style="margin-bottom:8px">Are you really sure?</h3><p class="muted small">This cannot be undone. Type DELETE to confirm.</p><input id="dl" type="text" style="margin-top:12px" autocomplete="off"><div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn danger" id="c2">Delete for good</button></div>`, (m2, close2) => { $('#c2', m2).onclick = () => { if ($('#dl', m2).value.trim().toUpperCase() === 'DELETE') { close2(); cb(); } else toast('Type DELETE to confirm'); }; }); };
  });
}
function anim(sel, from, opts = {}) {
  if (reduced || !window.gsap) return;
  const els = typeof sel === 'string' ? $$(sel) : sel; if (!els || !els.length) return;
  gsap.from(els, Object.assign({ opacity: 0, y: 14, duration: .5, ease: 'power3.out', stagger: .04, clearProps: 'all' }, from, opts));
}
function confetti() {
  if (reduced) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const x = c.getContext('2d'), cols = ['#3ee08f', '#6aa8ff', '#f3c454', '#a98bff', '#fff'];
  const P = Array.from({ length: 90 }, () => ({ x: innerWidth / 2, y: innerHeight * .45, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 3, c: cols[Math.random() * 5 | 0], a: Math.random() * 6 }));
  let f = 0; (function tick() { x.clearRect(0, 0, c.width, c.height); P.forEach(p => { p.vy += .45; p.x += p.vx; p.y += p.vy; p.a += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); }); if (++f < 110) requestAnimationFrame(tick); else c.remove(); })();
}
function ringSVG(pct, size = 118, label = '') {
  const r = (size - 14) / 2, C = 2 * Math.PI * r;
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><defs><linearGradient id="rg" x1="0" x2="1"><stop offset="0" stop-color="#1fb873"/><stop offset="1" stop-color="#6aa8ff"/></linearGradient></defs><circle class="tr" cx="${size / 2}" cy="${size / 2}" r="${r}"/><circle class="pr" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - pct / 100)}"/></svg><div class="v"><div><b>${Math.round(pct)}</b><div class="tiny muted">${label}</div></div></div></div>`;
}
function fillRings(root = document) { requestAnimationFrame(() => requestAnimationFrame(() => { $$('.ring .pr', root).forEach(c => c.style.strokeDashoffset = c.dataset.off); $$('.bar>i[data-w]', root).forEach(b => b.style.width = b.dataset.w + '%'); })); }
function sparkSVG(vals, h = 120, max) {
  if (!vals.length) return '<div class="empty small">No data yet</div>';
  const w = 300, mx = max || Math.max(...vals, 1), n = vals.length;
  const pts = vals.map((v, i) => [n === 1 ? w / 2 : i / (n - 1) * w, h - 8 - (v / mx) * (h - 20)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ee08f" stop-opacity=".35"/><stop offset="1" stop-color="#3ee08f" stop-opacity="0"/></linearGradient></defs><path d="${d} L${w} ${h} L0 ${h}Z" fill="url(#sg)"/><path d="${d}" fill="none" stroke="#3ee08f" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#3ee08f" vector-effect="non-scaling-stroke"/>`).join('')}</svg>`;
}

/* ---------- time tracking (learns how much you actually study) ---------- */
let lastAct = Date.now();
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(e => addEventListener(e, () => lastAct = Date.now(), { passive: true }));
const ROUTE_CAT = { learn: 'learn', exam: 'exam', cards: 'exam', pitch: 'pitch', judge: 'pitch', deck: 'pitch', tools: 'learn', play: 'exam' };
function addTime(cat, sec, day = dkey()) { const d = S.log[day] || (S.log[day] = {}); d[cat] = (d[cat] || 0) + sec; save(); }
setInterval(() => {
  const cat = ROUTE_CAT[route()] || (document.querySelector('.story,.tele') ? 'learn' : null);
  if (!cat || document.hidden || Date.now() - lastAct > 90000) return;
  addTime(cat, 15);
}, 15000);
const daySec = k => Object.values(S.log[k] || {}).reduce((a, b) => a + b, 0);
function weekMinutes(wi) { const st = S.startWeek + wi * 7 * DAY; let s = 0; for (let i = 0; i < 7; i++) s += daySec(dkey(st + i * DAY)); return s / 60; }

/* ---------- planner ---------- */
const eventTs = () => new Date(S.settings.eventDate + 'T08:00:00').getTime();
const weekIdx = () => Math.max(0, Math.floor((startOfDay(new Date()) - S.startWeek) / (7 * DAY)));
function planWeekFor(wi) { const daysLeft = (eventTs() - Date.now()) / DAY; if (daysLeft <= 4) return PLAN.length - 1; return Math.min(wi, PLAN.length - 2); }
function weekTarget(wi) {
  const base = (S.settings.hMin + S.settings.hMax) / 2 * 60;
  if (wi === 0) return base;
  const past = []; for (let i = 0; i < wi; i++) past.push(weekMinutes(i));
  const recent = past.slice(-3), avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  // learn: blend what you really did with the plan, nudge up 5%, keep inside a sane range
  const learned = avg * 1.05 * 0.65 + base * 0.35;
  return clamp(Math.round(learned / 5) * 5, S.settings.hMin * 60 * 0.6, S.settings.hMax * 60 * 1.3);
}
function allPlanTasks() {
  const out = [];
  PLAN.forEach((w, wi) => w.tasks.forEach((t, ti) => out.push({ id: `w${wi}t${ti}`, wi, t: t[0], min: t[1], cat: t[2], done: !!S.tasks[`w${wi}t${ti}`] })));
  return out;
}
function todayTodo() {
  const pw = planWeekFor(weekIdx());
  const tasks = allPlanTasks();
  const carried = tasks.filter(t => t.wi < pw && !t.done && t.wi !== PLAN.length - 1);
  const cur = tasks.filter(t => t.wi === pw);
  const target = weekTarget(weekIdx()), done = weekMinutes(weekIdx());
  const dow = (new Date().getDay() + 6) % 7, daysLeftWk = 7 - dow;
  const budget = Math.max(20, Math.round((target - done) / daysLeftWk));
  const todays = []; let used = 0;
  const doneToday = tasks.filter(t => t.done && dkey(S.tasks[t.id]) === dkey());
  for (const t of [...carried, ...cur.filter(t => !t.done)]) { if (used >= budget && todays.length) break; todays.push(t); used += t.min; }
  const custom = S.custom.filter(c => c.date === dkey() || (!c.done && c.date < dkey()));
  return { list: [...doneToday, ...todays], custom, budget, target, done, pw, carried: carried.length };
}
function readiness() {
  const cs = [...new Set(QUESTIONS.map(q => q.c))];
  const exam = cs.filter(c => (S.m[c] || {}).s >= 2).length / cs.length * 100;
  const last = S.scores[S.scores.length - 1]; const pitch = last ? last.total : 0;
  const t = allPlanTasks(); const plan = t.filter(x => x.done).length / t.length * 100;
  return { exam, pitch, plan, total: exam * .35 + pitch * .45 + plan * .2 };
}
function streak() { let n = 0, d = Date.now(); if (daySec(dkey(d)) < 600) d -= DAY; while (daySec(dkey(d)) >= 600) { n++; d -= DAY; } return n; }

/* ---------- icons ---------- */
const I = {
  today: '<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  plan: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  learn: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  exam: '<path d="M9 11l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="3"/>',
  pitch: '<path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  judge: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h.01M12 10h.01M15 10h.01"/>',
  rules: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  cards: '<rect x="3" y="6" width="14" height="14" rx="3"/><path d="M7 3h11a3 3 0 0 1 3 3v11"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  deck: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 12l3-3 2 2 4-4"/>',
  tools: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M17 14v6M14 17h6"/>',
  play: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 13h.01"/>',
  trophies: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>', play: '<path d="M7 4v16l13-8z"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>'
};
const ic = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
const NAV = [['today', 'Today'], ['plan', 'Plan'], ['learn', 'Learn'], ['exam', 'Exam'], ['pitch', 'Pitch'], ['deck', 'Deck studio'], ['judge', 'AI Judge'], ['tools', 'Tools'], ['play', 'Play'], ['cards', 'Cards'], ['trophies', 'Trophies'], ['rules', 'Rules'], ['settings', 'Settings']];
const MOBILE_NAV = ['today', 'plan', 'learn', 'exam', 'pitch', 'more'];
function buildNav() {
  $('.side').innerHTML = `<div class="brand"><div class="logo">FC</div>FCE Prep</div>` + NAV.map(([k, n]) => `<a href="#${k}" data-r="${k}">${ic(k, 19)}${n}</a>`).join('') + `<div class="foot">Districts in <span id="sideCd"></span></div>`;
  $('.nav').innerHTML = MOBILE_NAV.map(k => k === 'more' ? `<a href="#more" data-r="more"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>More</a>` : `<a href="#${k}" data-r="${k}">${ic(k, 22)}${NAV.find(n => n[0] === k)[1]}</a>`).join('');
}

/* ---------- router ---------- */
const route = () => (location.hash.slice(1).split('/')[0] || 'go');
const VIEWS = {};
let cleanup = null;
function render() {
  if (cleanup) { cleanup(); cleanup = null; }
  const r = route(); const v = VIEWS[r] || VIEWS.go || VIEWS.today;
  $$('[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === r || (a.dataset.r === 'more' && ['cards', 'rules', 'settings', 'more', 'deck', 'tools', 'play', 'trophies', 'today', 'plan', 'learn'].includes(r))));
  const old = $('main'); const main = document.createElement('main'); old.replaceWith(main); scrollTo(0, 0);
  cleanup = v(main) || null;
  fillRings(main);
  anim($$('main .card, main .top'), {});
}
addEventListener('hashchange', render);

/* ===================== TODAY ===================== */
VIEWS.today = el => {
  const td = todayTodo(), rd = readiness(), st = streak();
  const dueCards = CARDS.filter((c, i) => S.cards[i] && S.cards[i].due <= Date.now()).length;
  const nextL = LESSONS.find(l => !S.lessons[l.id]);
  const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  el.innerHTML = `
  <div class="top"><div><div class="sub">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1>${greet}, ${esc(S.settings.name || 'there')}</h1></div><div class="row" style="gap:6px"><a class="pill gold" href="#trophies" style="text-decoration:none">Lv ${xp().lvl} · ${xp().xp} XP</a><span class="pill">🔥 ${st}</span><button class="btn sm ghost" id="srch" aria-label="Search">${ic('search', 18)}</button></div></div>
  <div class="grid g2">
    <div class="card hero"><div class="k">Districts countdown</div><div class="cd" id="cd" style="margin-top:12px"></div><div class="small muted" style="margin-top:10px">${new Date(eventTs()).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · change in Settings</div></div>
    <div class="card"><div class="row" style="gap:18px">${ringSVG(rd.total, 118, 'ready')}<div class="stack" style="flex:1;min-width:0">
      <div><div class="row sp small"><span>Exam mastery</span><span class="mono">${Math.round(rd.exam)}%</span></div><div class="bar blue"><i data-w="${rd.exam}"></i></div></div>
      <div><div class="row sp small"><span>Pitch score</span><span class="mono">${Math.round(rd.pitch)}</span></div><div class="bar"><i data-w="${rd.pitch}"></i></div></div>
      <div><div class="row sp small"><span>Plan done</span><span class="mono">${Math.round(rd.plan)}%</span></div><div class="bar gold"><i data-w="${rd.plan}"></i></div></div></div></div></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Today's to-do <span class="pill ac">${fmtMin(td.budget)} budget</span></h3>
      ${td.carried ? `<div class="pill red" style="margin-bottom:10px">${td.carried} carried over from earlier weeks</div>` : ''}
      <div id="todo">${todoHTML(td)}</div>
      <div class="row" style="margin-top:12px"><button class="btn sm" id="addT">+ Add task</button><a class="btn sm ghost" href="#plan">Full plan →</a></div></div>
    <div class="stack">
      <div class="card"><h3>This week <span class="small muted">${PLAN[td.pw].w}</span></h3><div class="row sp small"><span>${fmtMin(td.done)} studied</span><span class="muted">target ${fmtMin(td.target)}</span></div><div class="bar" style="margin-top:8px"><i data-w="${clamp(td.done / td.target * 100, 0, 100)}"></i></div>
        <div class="row" style="margin-top:14px;gap:8px"><button class="btn sm" id="focus">⏱ Focus timer</button><button class="btn sm ghost" id="logT">+ Log offline time</button></div></div>
      <div class="card"><h3>Daily habits</h3>
        <a class="todo" href="#cards" style="text-decoration:none;color:inherit"><div class="ck"></div><div class="tt">Flashcards<div class="meta">${dueCards} due now + new cards</div></div></a>
        <a class="todo" href="#exam/practice" style="text-decoration:none;color:inherit"><div class="ck"></div><div class="tt">10 smart practice questions<div class="meta">Weighted to your weak areas</div></div></a>
        ${nextL ? `<a class="todo" href="#learn/${nextL.id}" style="text-decoration:none;color:inherit"><div class="ck"></div><div class="tt">Next lesson: ${esc(nextL.t)}<div class="meta">${nextL.e} story + quiz</div></div></a>` : ''}
      </div></div>
  </div>`;
  bindTodo(el);
  $('#srch').onclick = palette;
  $('#addT').onclick = addTaskModal;
  $('#focus').onclick = focusModal;
  $('#logT').onclick = logModal;
  const t = setInterval(tickCd, 1000); tickCd();
  return () => clearInterval(t);
};
function tickCd() {
  const d = Math.max(0, eventTs() - Date.now());
  const parts = [[Math.floor(d / DAY), 'days'], [Math.floor(d / 36e5) % 24, 'hrs'], [Math.floor(d / 6e4) % 60, 'min'], [Math.floor(d / 1e3) % 60, 'sec']];
  const cd = $('#cd'); if (cd) cd.innerHTML = parts.map(p => `<div><b>${String(p[0]).padStart(2, '0')}</b><span>${p[1]}</span></div>`).join('');
  const sc = $('#sideCd'); if (sc) sc.textContent = Math.ceil(d / DAY) + ' days';
}
function todoHTML(td) {
  const items = td.list.map(t => `<div class="todo ${t.done ? 'done' : ''}" data-t="${t.id}"><button class="ck" aria-label="done">${ic('check', 14)}</button><div class="tt">${esc(t.t)}<div class="meta"><span class="cat ${t.cat}"></span> ${t.cat} · ~${t.min}m${t.wi < td.pw ? ' · carried over' : ''}</div></div></div>`);
  const cust = td.custom.map(c => `<div class="todo ${c.done ? 'done' : ''}" data-c="${c.id}"><button class="ck">${ic('check', 14)}</button><div class="tt">${esc(c.t)}<div class="meta"><span class="cat ${c.cat}"></span> ${c.cat} · ~${c.min}m · custom</div></div></div>`);
  const all = items.concat(cust);
  return all.length ? all.join('') : '<div class="empty">All done for today. Go rest or get ahead on the Plan tab.</div>';
}
function bindTodo(root) {
  root.addEventListener('click', e => {
    const row = e.target.closest('.todo[data-t],.todo[data-c]'); if (!row || !e.target.closest('.ck')) return;
    if (row.dataset.t) { const id = row.dataset.t; if (S.tasks[id]) delete S.tasks[id]; else S.tasks[id] = Date.now(); }
    else { const c = S.custom.find(x => x.id === row.dataset.c); c.done = !c.done; }
    row.classList.toggle('done'); save();
    if (row.classList.contains('done') && window.gsap && !reduced) gsap.fromTo(row, { scale: .98 }, { scale: 1, duration: .4, ease: 'back.out(3)' });
  });
}
function addTaskModal() {
  modal(`<h3 style="margin-bottom:14px">Add a task</h3><label class="f">Task</label><input id="tt" type="text" placeholder="e.g. Email advisor about exam calculator rule"><div class="grid g2" style="margin-top:12px"><div><label class="f">Minutes</label><input id="tm" type="number" value="20" min="5" step="5"></div><div><label class="f">Type</label><select id="tc"><option>pitch</option><option>exam</option><option>research</option><option>admin</option></select></div></div><label class="f" style="margin-top:12px">Day</label><input id="td" type="date" value="${dkey()}"><div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn pri" id="ok">Add</button></div>`, (m, close) => {
    $('#tt', m).focus();
    $('#ok', m).onclick = () => { const t = $('#tt', m).value.trim(); if (!t) return toast('Name the task'); S.custom.push({ id: 'c' + Date.now(), t, min: +$('#tm', m).value || 20, cat: $('#tc', m).value, date: $('#td', m).value, done: false }); save(); close(); render(); };
  });
}
function logModal() {
  modal(`<h3 style="margin-bottom:6px">Log offline time</h3><p class="small muted">Worked on slides in Canva or practiced out loud? Log it so the planner learns your real pace.</p><div class="grid g2" style="margin-top:12px"><div><label class="f">Minutes</label><input id="lm" type="number" value="30" min="5" step="5"></div><div><label class="f">Type</label><select id="lc"><option value="pitch">pitch</option><option value="exam">exam</option><option value="learn">research</option><option value="other">admin</option></select></div></div><div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn pri" id="ok">Log it</button></div>`, (m, close) => {
    $('#ok', m).onclick = () => { addTime($('#lc', m).value, (+$('#lm', m).value || 0) * 60); close(); toast('Logged'); render(); };
  });
}
function focusModal() {
  let sec = 25 * 60, left = sec, run = false, t = null, cat = 'pitch', started = 0;
  modal(`<h3 style="margin-bottom:10px">Focus timer</h3><div class="seg" id="len"><button data-m="15">15</button><button data-m="25" class="on">25</button><button data-m="45">45</button></div><div class="timer" id="ft" style="margin:20px 0">25:00</div><label class="f">Working on</label><div class="seg" id="fc"><button data-c="pitch" class="on">Pitch</button><button data-c="exam">Exam</button><button data-c="learn">Research</button></div><div class="row" style="margin-top:20px;justify-content:space-between"><button class="btn" data-close>Close</button><button class="btn pri" id="go">Start</button></div><p class="tiny muted" style="margin-top:10px">Time is logged when you stop or finish.</p>`, (m, close) => {
    const show = () => $('#ft', m).textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
    const stop = () => { if (run) { const used = Math.round((Date.now() - started) / 1000); addTime(cat, used); toast('Logged ' + fmtMin(used / 60)); } run = false; clearInterval(t); $('#go', m).textContent = 'Start'; };
    $('#len', m).onclick = e => { const b = e.target.closest('button'); if (!b || run) return; $$('#len button', m).forEach(x => x.classList.toggle('on', x === b)); sec = left = +b.dataset.m * 60; show(); };
    $('#fc', m).onclick = e => { const b = e.target.closest('button'); if (!b || run) return; $$('#fc button', m).forEach(x => x.classList.toggle('on', x === b)); cat = b.dataset.c; };
    $('#go', m).onclick = () => { if (run) return stop(); run = true; started = Date.now(); const end = Date.now() + left * 1000; $('#go', m).textContent = 'Stop'; t = setInterval(() => { left = Math.max(0, Math.round((end - Date.now()) / 1000)); show(); if (!left) { stop(); confetti(); toast('Focus block done 💪'); } }, 250); };
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) stop(); }, true);
  });
}

/* ===================== PLAN ===================== */
VIEWS.plan = el => {
  const wi = weekIdx(), pw = planWeekFor(wi), tasks = allPlanTasks();
  const weeks = []; for (let i = 0; i <= wi; i++) weeks.push(weekMinutes(i));
  const tgt = weekTarget(wi), days = Math.ceil((eventTs() - Date.now()) / DAY);
  const learnedNote = wi === 0 ? `Week 1 uses your range (${S.settings.hMin}-${S.settings.hMax} h). After this week it adapts to what you actually log.` : `Learned from your last ${Math.min(wi, 3)} week(s): you average ${fmtMin(weeks.slice(-4, -1).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(wi, 3)))} a week.`;
  const strip = []; for (let i = 0; i < 7; i++) { const d = S.startWeek + wi * 7 * DAY + i * DAY; const m = daySec(dkey(d)) / 60; strip.push(`<div style="flex:1;text-align:center"><div class="tiny muted">${new Date(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</div><div style="height:60px;display:flex;align-items:flex-end;justify-content:center;margin:6px 0"><div style="width:70%;border-radius:6px;background:${dkey(d) === dkey() ? 'var(--ac)' : 'var(--line2)'};height:${clamp(m / 90 * 100, 4, 100)}%"></div></div><div class="tiny mono">${Math.round(m)}m</div></div>`); }
  el.innerHTML = `
  <div class="top"><div><div class="sub">${days} days to districts</div><h1>Your plan</h1></div><button class="btn sm" id="addT">+ Task</button></div>
  <div class="grid g2">
    <div class="card"><h3>This week's target <span class="pill ac mono">${fmtMin(tgt)}</span></h3><p class="small muted">${learnedNote}</p><div class="row" style="margin-top:12px">${strip.join('')}</div></div>
    <div class="card"><h3>Hours per week</h3>${weeks.length > 1 ? sparkSVG(weeks.map(x => x / 60)) : '<div class="empty small">Your weekly trend shows up after week 1. Every minute in Learn, Exam and Pitch is tracked automatically.</div>'}<div class="row sp tiny muted"><span>Week 1</span><span>Now</span></div></div>
  </div>
  <div class="stack" style="margin-top:14px">${PLAN.map((w, i) => {
    const ts = tasks.filter(t => t.wi === i), dn = ts.filter(t => t.done).length, mins = ts.reduce((a, t) => a + t.min, 0);
    const state = i < pw ? 'past' : i === pw ? 'now' : 'next';
    return `<div class="card"><h3><span>${esc(w.w)} ${state === 'now' ? '<span class="pill ac">now</span>' : ''}</span><span class="small muted mono">${dn}/${ts.length} · ${fmtMin(mins)}</span></h3><div class="bar" style="margin-bottom:12px"><i data-w="${dn / ts.length * 100}"></i></div>
    <div ${state === 'next' && i > pw + 1 ? 'class="hide" data-fold' : ''}>${ts.map(t => `<div class="todo ${t.done ? 'done' : ''}" data-t="${t.id}"><button class="ck">${ic('check', 14)}</button><div class="tt">${esc(t.t)}<div class="meta"><span class="cat ${t.cat}"></span> ${t.cat} · ~${t.min}m</div></div></div>`).join('')}</div>
    ${state === 'next' && i > pw + 1 ? '<button class="btn sm ghost" data-unfold>Show tasks</button>' : ''}</div>`;
  }).join('')}
  ${S.custom.length ? `<div class="card"><h3>Custom tasks</h3>${S.custom.map(c => `<div class="todo ${c.done ? 'done' : ''}" data-c="${c.id}"><button class="ck">${ic('check', 14)}</button><div class="tt">${esc(c.t)}<div class="meta"><span class="cat ${c.cat}"></span> ${c.date} · ~${c.min}m</div></div><button class="btn sm ghost" data-del="${c.id}">${ic('x', 14)}</button></div>`).join('')}</div>` : ''}
  </div>`;
  bindTodo(el);
  $('#addT').onclick = addTaskModal;
  el.addEventListener('click', e => {
    const u = e.target.closest('[data-unfold]'); if (u) { u.previousElementSibling.classList.remove('hide'); u.remove(); }
    const d = e.target.closest('[data-del]'); if (d) { S.custom = S.custom.filter(c => c.id !== d.dataset.del); save(); render(); }
  });
};

/* ===================== LEARN (story lessons) ===================== */
const lessonConcepts = id => Object.keys(CONCEPTS).filter(k => CONCEPTS[k].l === id);
const lessonMastery = id => { const cs = lessonConcepts(id).filter(c => QUESTIONS.some(q => q.c === c)); return cs.length ? cs.filter(c => (S.m[c] || {}).s >= 2).length / cs.length * 100 : 0; };
VIEWS.learn = el => {
  const sub = location.hash.split('/')[1];
  if (sub && LESSONS.find(l => l.id === sub)) { setTimeout(() => playLesson(sub), 50); history.replaceState(null, '', '#learn'); }
  el.innerHTML = `<div class="top"><div><div class="sub">Story lessons · labs · quizzes</div><h1>Learn</h1></div></div>
  <p class="small muted" style="margin:-8px 0 16px">Each lesson plays like an Instagram story (tap right to skip, left to go back, hold to pause), then quizzes you on only what you just saw.</p>
  <div class="grid g2">${LESSONS.map(l => { const m = lessonMastery(l.id), n = lessonConcepts(l.id).length; return `<div class="card hover les ${S.lessons[l.id] ? 'done' : ''}" data-l="${l.id}"><div class="em">${l.e}</div><div style="flex:1;min-width:0"><div class="t">${esc(l.t)}</div><div class="small muted">${n} scenes${l.lab ? ' · lab' : ''} · ${esc(l.intro)}</div><div class="bar" style="margin-top:8px;height:5px"><i data-w="${m}"></i></div></div>${S.lessons[l.id] ? '<span class="pill ac">✓</span>' : ''}</div>`; }).join('')}</div>`;
  el.addEventListener('click', e => { const c = e.target.closest('[data-l]'); if (c) playLesson(c.dataset.l); });
};

function sceneHTML(s) {
  const d = s.d;
  switch (s.v) {
    case 'icon': return `<div class="sv sv-icon"><div class="e pop">${d.e}</div><div class="t pop" style="animation-delay:.15s">${esc(d.t)}</div></div>`;
    case 'stat': return `<div class="sv sv-stat"><div class="n pop" data-count="${esc(d.n)}">${esc(d.n)}</div><div class="s pop" style="animation-delay:.2s">${esc(d.s)}</div></div>`;
    case 'grid': return `<div class="sv sv-grid">${d.items.map((it, i) => `<div class="pop" style="animation-delay:${i * .12}s"><span>${it[0]}</span>${esc(it[1])}</div>`).join('')}</div>`;
    case 'bars': { const mx = Math.max(...d.items.map(x => x[1])); return `<div class="sv sv-bars">${d.items.map((it, i) => `<div class="b"><i style="height:${it[1] / mx * 82}%;animation-delay:${i * .15}s"></i><em>${esc(it[0])}</em></div>`).join('')}</div>`; }
    case 'vs': return `<div class="sv sv-vs"><div class="s pop"><h4>${esc(d.a.t)}</h4>${d.a.b.map(x => `<p>${esc(x)}</p>`).join('')}</div><div class="x pop" style="animation-delay:.2s">vs</div><div class="s pop" style="animation-delay:.35s"><h4>${esc(d.b.t)}</h4>${d.b.b.map(x => `<p>${esc(x)}</p>`).join('')}</div></div>`;
    case 'flow': return `<div class="sv sv-flow"><div class="nd pop">${esc(d.a)}</div><div class="pipe"><span>${d.m}</span><span>${d.m}</span><span>${d.m}</span></div><div class="nd pop" style="animation-delay:.25s">${esc(d.b)}</div></div>`;
    case 'steps': return `<div class="sv sv-steps">${d.items.map((it, i) => `<div class="pop" style="animation-delay:${i * .18}s"><i>${i + 1}</i>${esc(it)}</div>`).join('')}</div>`;
    case 'eq': return `<div class="sv sv-eq">${d.parts.map((p, i) => `<span class="pop ${/^[=+−x÷\-]$/.test(p) ? 'op' : ''}" style="animation-delay:${i * .1}s">${esc(p)}</span>`).join('')}</div>`;
    case 'calc': return `<div class="sv sv-calc">${d.lines.map((l, i) => `<div class="pop" style="animation-delay:${i * .45}s">${esc(l)}</div>`).join('')}</div>`;
    case 'line': { const w = 400, h = 200, n = d.pts.length; const pts = d.pts.map((v, i) => [i / (n - 1) * w, h - v / 70 * h]); const p = pts.map((q, i) => (i ? 'L' : 'M') + q[0] + ' ' + q[1]).join(' '); return `<div class="sv sv-line"><svg viewBox="0 0 ${w} ${h}"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ee08f"/><stop offset="1" stop-color="#3ee08f" stop-opacity="0"/></linearGradient></defs><path class="ar" d="${p} L${w} ${h} L0 ${h}Z"/><path class="ln" d="${p}"/></svg><div class="lb">${esc(d.label)}</div></div>`; }
    case 'ring': return `<div class="sv sv-ring">${ringSVG(d.pct, 200, d.label)}</div>`;
  }
  return '';
}
function playLesson(id, opts = {}) {
  const L = LESSONS.find(l => l.id === id); const keys = lessonConcepts(id);
  const scenes = [{ v: 'icon', d: { e: L.e, t: L.intro }, c: `<b>${esc(L.t)}</b>` }].concat(keys.map(k => CONCEPTS[k]));
  if (opts.only) scenes.splice(0, scenes.length, ...opts.only.map(k => CONCEPTS[k]));
  const dur = 7000; let i = 0, t0 = 0, el0 = 0, paused = false, raf, holdT, held = false, closed = false;
  const ov = document.createElement('div'); ov.className = 'story';
  ov.innerHTML = `<div class="prog">${scenes.map(() => '<i><b></b></i>').join('')}</div><div class="hd"><span>${L.e} ${esc(L.t)}</span><span class="row" style="gap:4px"><button class="btn sm ghost" id="snar" title="Narrate">${S.settings.narrate ? '🔊' : '🔈'}</button><button class="btn sm ghost" id="sx">${ic('x', 18)}</button></span></div><div class="stage"><div class="tapL"></div><div class="tapR"></div><div class="vis"></div><div class="cap"></div></div><div class="ft"><span class="tiny muted">Tap sides to skip · hold to pause · ← → keys</span></div>`;
  document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  const bars = $$('.prog i', ov);
  function show(n) {
    i = n; bars.forEach((b, k) => { b.classList.toggle('done', k < i); b.classList.toggle('cur', k === i); b.firstChild.style.width = k < i ? '100%' : '0'; });
    const s = scenes[i]; const vis = $('.vis', ov), cap = $('.cap', ov);
    vis.classList.remove('play'); vis.innerHTML = sceneHTML(s); cap.innerHTML = s.c;
    void vis.offsetWidth; vis.classList.add('play'); fillRings(vis);
    if (window.gsap && !reduced) gsap.fromTo(cap, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .5, delay: .15, ease: 'power2.out' });
    t0 = performance.now(); el0 = 0;
    if (S.settings.narrate) speak(cap.textContent);
  }
  function loop(now) {
    if (closed) return;
    if (!paused) { const p = clamp((el0 + now - t0) / dur, 0, 1); bars[i].firstChild.style.width = p * 100 + '%'; if (p >= 1) { next(); } }
    if (!closed) raf = requestAnimationFrame(loop);
  }
  function next() { if (i < scenes.length - 1) show(i + 1); else finish(); }
  function prev() { show(Math.max(0, i - 1)); }
  function pause(v) { if (v === paused) return; if (v) el0 += performance.now() - t0; else t0 = performance.now(); paused = v; }
  function close() { if (closed) return; closed = true; if ('speechSynthesis' in window) speechSynthesis.cancel(); cancelAnimationFrame(raf); ov.remove(); document.body.style.overflow = ''; removeEventListener('keydown', key); }
  function finish() {
    if (closed) return;
    close();
    if (opts.only) return opts.done && opts.done();
    if (L.lab) openLab(L.lab, () => lessonQuiz(id)); else lessonQuiz(id);
  }
  function key(e) { if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); } else if (e.key === 'ArrowLeft') prev(); else if (e.key === 'Escape') close(); }
  addEventListener('keydown', key);
  const stage = $('.stage', ov);
  stage.addEventListener('pointerdown', () => { held = false; holdT = setTimeout(() => { held = true; pause(true); ov.classList.add('paused'); }, 220); });
  stage.addEventListener('pointerup', e => { clearTimeout(holdT); if (held) { pause(false); ov.classList.remove('paused'); return; } if (e.target.classList.contains('tapL')) prev(); else next(); });
  stage.addEventListener('pointerleave', () => { clearTimeout(holdT); if (held) { held = false; pause(false); } });
  $('#sx', ov).onclick = close;
  $('#snar', ov).onclick = e => { e.stopPropagation(); S.settings.narrate = !S.settings.narrate; save(); e.currentTarget.textContent = S.settings.narrate ? '🔊' : '🔈'; if (S.settings.narrate) speak($('.cap', ov).textContent); else speechSynthesis.cancel(); };
  show(0); raf = requestAnimationFrame(loop);
}

/* ---------- labs ---------- */
const LABS = {
  valuation: { t: 'Valuation lab', inputs: [['sde', 'SDE (yearly owner earnings)', 100000, 1500000, 10000, 480000, money], ['mult', 'Multiple', 1, 6, .1, 2.8, v => v.toFixed(1) + 'x'], ['assets', 'Net assets (if liquidated)', 50000, 2000000, 10000, 420000, money]],
    calc: v => ({ bars: [['Sell (earnings)', v.sde * v.mult], ['Liquidate (assets)', v.assets]], note: v.sde * v.mult > v.assets ? `Selling as a going concern is worth <b>${money(v.sde * v.mult - v.assets)} more</b> than winding down. Earnings power is the asset.` : `Here the <b>assets</b> are worth more than the earnings. Liquidation may be the smarter exit.` }) },
  installment: { t: 'Seller financing lab', inputs: [['price', 'Sale price', 300000, 3000000, 25000, 1200000, money], ['down', 'Down payment', 0, 60, 5, 25, v => v + '%'], ['rate', 'Interest rate', 2, 12, .5, 7, v => v + '%'], ['yrs', 'Years', 2, 15, 1, 7, v => v + ' yrs']],
    calc: v => { const P = v.price * (1 - v.down / 100), r = v.rate / 100 / 12, n = v.yrs * 12, pm = r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n; return { bars: [['Cash at close', v.price * v.down / 100], ['Financed', P], ['Interest earned', pm * n - P]], note: `Owner gets <b>${money(pm)}/month</b> for ${v.yrs} years and earns <b>${money(pm * n - P)}</b> in interest. Risk: if the buyer defaults, payments stop.` }; } },
  compound: { t: 'Retirement savings lab', inputs: [['now', 'Saved today', 0, 2000000, 25000, 400000, money], ['yr', 'Added per year', 0, 100000, 1000, 32500, money], ['rate', 'Return', 2, 10, .5, 6, v => v + '%'], ['yrs', 'Years to retire', 1, 15, 1, 7, v => v + ' yrs']],
    calc: v => { const pts = []; let b = v.now; for (let y = 0; y <= v.yrs; y++) { pts.push(b); b = b * (1 + v.rate / 100) + v.yr; } const end = pts[pts.length - 1]; return { line: pts, note: `Grows to <b>${money(end)}</b>. At 4% that is about <b>${money(end * .04)}/year</b> of income. Contributions: ${money(v.yr * v.yrs)}, growth: ${money(end - v.now - v.yr * v.yrs)}.` }; } },
  withdrawal: { t: 'Withdrawal lab', inputs: [['egg', 'Nest egg', 300000, 5000000, 50000, 1500000, money], ['wd', 'Withdrawal rate', 2, 10, .25, 4, v => v + '%'], ['ret', 'Return', 0, 9, .5, 5, v => v + '%'], ['inf', 'Inflation', 0, 6, .5, 3, v => v + '%']],
    calc: v => { let b = v.egg, w = v.egg * v.wd / 100, y = 0; const pts = [b]; while (b > 0 && y < 40) { b = b * (1 + v.ret / 100) - w; w *= 1 + v.inf / 100; y++; pts.push(Math.max(0, b)); } return { line: pts, note: b > 0 ? `Money still lasts past <b>40 years</b>. Year-1 income: ${money(v.egg * v.wd / 100)}.` : `Money runs out in <b>${y} years</b>. Retire at 60 and that is age ${60 + y}.` }; } },
  tvm: { t: 'Time value of money lab', inputs: [['pv', 'Present value', 100, 100000, 100, 10000, money], ['rate', 'Rate', 0, 15, .5, 6, v => v + '%'], ['n', 'Years', 1, 40, 1, 12, v => v + ' yrs']],
    calc: v => { const pts = []; for (let y = 0; y <= v.n; y++) pts.push(v.pv * Math.pow(1 + v.rate / 100, y)); return { line: pts, note: `FV = ${money(v.pv)} x (1 + ${v.rate}%)^${v.n} = <b>${money(pts[pts.length - 1])}</b>. Rule of 72 says it doubles every <b>${v.rate ? (72 / v.rate).toFixed(1) : '∞'} years</b>.` }; } }
};
function openLab(k, done) {
  const L = LABS[k]; const v = {}; L.inputs.forEach(x => v[x[0]] = x[5]);
  modal(`<div class="row sp"><h3>🧪 ${L.t}</h3><span class="pill blue">drag the sliders</span></div><div id="lo" style="margin:14px 0"></div><div id="li" class="stack"></div><div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn pri" id="lok">${done ? 'Continue to quiz →' : 'Done'}</button></div>`, (m, close) => {
    $('#li', m).innerHTML = L.inputs.map(x => `<div><div class="row sp small"><label>${x[1]}</label><b class="mono" id="v_${x[0]}">${x[6](x[5])}</b></div><input type="range" data-k="${x[0]}" min="${x[2]}" max="${x[3]}" step="${x[4]}" value="${x[5]}"></div>`).join('');
    const draw = () => {
      const r = L.calc(v); let vis = '';
      if (r.bars) { const mx = Math.max(...r.bars.map(b => b[1]), 1); vis = `<div class="stack">${r.bars.map((b, i) => `<div><div class="row sp small"><span>${b[0]}</span><b class="mono">${money(b[1])}</b></div><div class="bar ${['', 'blue', 'gold'][i % 3]}"><i style="width:${b[1] / mx * 100}%;transition:width .25s"></i></div></div>`).join('')}</div>`; }
      if (r.line) vis = sparkSVG(r.line, 140);
      $('#lo', m).innerHTML = vis + `<p class="small" style="margin-top:12px">${r.note}</p>`;
    };
    m.addEventListener('input', e => { const k2 = e.target.dataset.k; if (!k2) return; v[k2] = +e.target.value; const x = L.inputs.find(i => i[0] === k2); $('#v_' + k2, m).textContent = x[6](v[k2]); draw(); });
    draw(); $('#lok', m).onclick = () => { close(); done && done(); };
  });
}

/* ---------- quiz engine ---------- */
function mark(q, ok) {
  const m = S.m[q.c] || (S.m[q.c] = { s: 0, ok: 0, no: 0 }); const was = m.s >= 2;
  if (ok) { m.s++; m.ok++; } else { m.s = 0; m.no++; S.notebook[q.id] = Date.now(); }
  if (ok && m.s >= 2) delete S.notebook[q.id];
  m.last = Date.now();
  const qs = S.qs[q.id] || (S.qs[q.id] = { ok: 0, no: 0 }); ok ? qs.ok++ : qs.no++;
  save(); return !was && m.s >= 2;
}
function retryFor(q, used) { const alts = allQs().filter(x => x.c === q.c && x.id !== q.id && !used.has(x.id)); return alts.length ? alts[Math.random() * alts.length | 0] : q; }
/* mode: 'learn' | 'practice' | 'mock' */
function runQuiz(items, { mode = 'practice', title = 'Practice', onDone, timeLimit } = {}) {
  const queue = items.slice(); const used = new Set(items.map(q => q.id));
  let idx = 0, right = 0, first = 0, answered = 0, mastered = 0, by = {}, results = [], locked = false;
  const endTs = timeLimit ? Date.now() + timeLimit * 1000 : 0;
  const ov = document.createElement('div'); ov.className = 'story'; ov.style.overflowY = 'auto';
  document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  let timerI = timeLimit ? setInterval(() => { const l = Math.max(0, Math.round((endTs - Date.now()) / 1000)); const e = $('#qt', ov); if (e) e.textContent = Math.floor(l / 60) + ':' + String(l % 60).padStart(2, '0'); if (!l) finish(); }, 500) : null;
  function close() { clearInterval(timerI); ov.remove(); document.body.style.overflow = ''; removeEventListener('keydown', key); }
  function draw() {
    const q = queue[idx]; locked = false;
    const order = shuffle(q.ch.map((t, k) => ({ t, k })));
    ov._order = order;
    ov.innerHTML = `<div class="qwrap" style="padding:18px 16px 40px;width:100%"><div class="qhead"><button class="btn sm ghost" id="qx">${ic('x', 18)}</button><span class="small muted">${esc(title)} · ${idx + 1}/${queue.length}</span>${timeLimit ? '<span class="pill gold mono" id="qt"></span>' : `<span class="pill ac mono">${right} ✓</span>`}</div>
      <div class="bar" style="height:4px;margin-bottom:18px"><i style="width:${idx / queue.length * 100}%"></i></div>
      <div class="row wrap" style="gap:6px"><span class="pill">${IA[q.ia] || q.ia}</span><span class="pill blue">${esc(q.type)}</span>${q.retry ? '<span class="pill gold">↻ retry, reworded</span>' : ''}${q.ai ? '<span class="pill">AI</span>' : ''}</div>
      <div class="qtext">${esc(q.q)}</div>
      <div id="opts">${order.map((o, n) => `<button class="opt" data-k="${o.k}"><span class="ky">${n + 1}</span><span>${esc(o.t)}</span></button>`).join('')}</div><div id="fbx"></div></div>`;
    $('#qx', ov).onclick = () => { if (mode === 'mock' && answered) { if (!window.confirm('Quit this exam? Progress is lost.')) return; } close(); onDone && onDone(null); };
    $('#opts', ov).onclick = e => { const b = e.target.closest('.opt'); if (b) answer(+b.dataset.k, b); };
    anim($$('.opt', ov), { y: 10, stagger: .05, duration: .35 });
  }
  function answer(k, btn) {
    if (locked) return; locked = true; const q = queue[idx]; const ok = k === 0; answered++;
    if (!q.retry) { by[q.ia] = by[q.ia] || [0, 0]; by[q.ia][1]++; if (ok) { by[q.ia][0]++; first++; } }
    if (ok) { right++; const pc = $('.qhead .pill.ac', ov); if (pc) pc.textContent = right + ' ✓'; }
    results.push({ q, ok });
    if (mark(q, ok)) mastered++;
    if (mode === 'mock') { idx++; if (idx >= queue.length) finish(); else draw(); return; }
    const opts = $$('.opt', ov);
    opts.forEach(o => { const kk = +o.dataset.k; if (kk === 0) o.classList.add('right'); else if (o === btn) o.classList.add('wrong'); else o.classList.add('dim'); });
    if (!ok) { btn.classList.add('shake'); const pos = Math.min(queue.length, idx + 4); const alt = retryFor(q, used); used.add(alt.id); queue.splice(pos, 0, Object.assign({}, alt, { retry: true })); }
    const lesson = LESSONS.find(l => l.id === q.l);
    $('#fbx', ov).innerHTML = `<div class="fb ${ok ? 'ok' : 'no'} fade-in"><b>${ok ? pick(['Nailed it.', 'Correct.', 'Yes, exactly.', 'Clean.']) : 'Not quite.'}</b>
      ${ok ? '' : `<div class="cmp"><div class="y"><div class="tiny muted">You picked</div>${esc(q.ch[k])}</div><div class="c"><div class="tiny muted">Right answer</div>${esc(q.ch[0])}</div></div>`}
      <p class="small" style="margin-top:6px">${esc(q.why)}</p>
      ${!ok && CONCEPTS[q.c] ? `<div class="row wrap" style="margin-top:10px"><button class="btn sm" id="see">▶ See it (5 sec)</button>${S.settings.apiKey ? '<button class="btn sm ghost" id="aiex">✨ Explain differently</button>' : ''}<span class="tiny muted">This comes back in ~4 questions, reworded.</span></div>` : ''}
      <div id="aiout"></div>
      <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn pri" id="nx">Next <span class="kbd">Enter</span></button></div></div>`;
    const see = $('#see', ov); if (see) see.onclick = () => playLesson(q.l || 'case', { only: [q.c] });
    const ax = $('#aiex', ov); if (ax) ax.onclick = async () => { ax.disabled = true; $('#aiout', ov).innerHTML = '<div class="small muted" style="margin-top:10px"><span class="typing"><i></i><i></i><i></i></span></div>'; try { const r = await ai([{ role: 'user', content: `DECA finance exam question: "${q.q}" Correct: "${q.ch[0]}". Student picked "${q.ch[k]}". In 3 short bullet lines a 10th grader remembers: why theirs is tempting, why the right one is right, a memory hook. No em dashes.` }], 'You are a concise, friendly finance tutor.', 300); $('#aiout', ov).innerHTML = `<div class="small" style="margin-top:10px;white-space:pre-wrap">${esc(r)}</div>`; } catch (e) { $('#aiout', ov).innerHTML = `<div class="small" style="color:var(--red);margin-top:10px">${esc(e.message)}</div>`; } };
    $('#nx', ov).onclick = nextQ; $('#nx', ov).focus({ preventScroll: true });
    if (ok && window.gsap && !reduced) gsap.fromTo(btn, { scale: .97 }, { scale: 1, duration: .5, ease: 'back.out(4)' });
  }
  function nextQ() { idx++; if (idx >= queue.length) finish(); else draw(); }
  function finish() {
    clearInterval(timerI); const total = Object.values(by).reduce((a, b) => a + b[1], 0); const pct = total ? Math.round(first / total * 100) : 0;
    if (mode === 'mock') S.exams.push({ ts: Date.now(), n: total, ok: first, by });
    save();
    const misses = results.filter(r => !r.ok && !r.q.retry);
    ov.innerHTML = `<div class="qwrap" style="padding:28px 16px 40px;width:100%;text-align:center"><div style="display:flex;justify-content:center">${ringSVG(pct, 170, 'first-try')}</div>
      <h2 style="margin-top:16px;font-size:26px">${pct >= 85 ? 'Exam-ready on this set 🔥' : pct >= 70 ? 'Solid. Keep pushing.' : 'Good reps. The retries are where you learn.'}</h2>
      <p class="muted" style="margin-top:6px">${first}/${total} right on first try${mastered ? ` · ${mastered} concept${mastered > 1 ? 's' : ''} newly mastered` : ''}</p>
      <div class="card" style="text-align:left;margin-top:20px"><h3>By instructional area</h3>${Object.entries(by).map(([k, v]) => `<div class="ia"><div><div class="small">${IA[k]}</div><div class="bar" style="margin-top:4px"><i data-w="${v[0] / v[1] * 100}"></i></div></div><div class="mono small" style="text-align:right">${v[0]}/${v[1]}</div></div>`).join('')}</div>
      ${misses.length ? `<div class="card" style="text-align:left;margin-top:14px"><h3>Review misses</h3>${misses.map(r => `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div class="small">${esc(r.q.q)}</div><div class="small" style="color:var(--ac);margin-top:3px">✓ ${esc(r.q.ch[0])}</div><div class="tiny muted">${esc(r.q.why)}</div></div>`).join('')}</div>` : ''}
      <div class="row" style="justify-content:center;margin-top:20px"><button class="btn pri" id="dn">Done</button></div></div>`;
    fillRings(ov); if (pct >= 85) confetti();
    $('#dn', ov).onclick = () => { close(); onDone && onDone({ pct, first, total }); };
  }
  function key(e) {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key >= '1' && e.key <= '4' && !locked) { const b = $$('.opt', ov)[+e.key - 1]; if (b) answer(+b.dataset.k, b); }
    else if (e.key === 'Enter' && locked && $('#nx', ov)) { e.preventDefault(); nextQ(); }
    else if (e.key === 'Escape') { close(); onDone && onDone(null); }
  }
  addEventListener('keydown', key);
  draw();
}
const pick = a => a[Math.random() * a.length | 0];
function lessonQuiz(id) {
  const keys = lessonConcepts(id); let qs = [];
  keys.forEach(k => { const pool = shuffle(allQs().filter(q => q.c === k)); if (pool.length) qs.push(pool[0]); });
  qs = shuffle(qs);
  if (!qs.length) { S.lessons[id] = Date.now(); save(); return render(); }
  runQuiz(qs, { mode: 'learn', title: LESSONS.find(l => l.id === id).t, onDone: r => { if (r) { S.lessons[id] = Date.now(); save(); if (r.pct >= 70) confetti(); } render(); } });
}

/* ===================== EXAM ===================== */
function weightedPick(n, iaFilter) {
  const bp = CASE.blueprint; const pool = allQs().filter(q => (iaFilter ? q.ia === iaFilter : true));
  const w = pool.map(q => { const m = S.m[q.c] || {}; const st = S.qs[q.id]; return ((bp[q.ia] || 8) + 2) * (m.s >= 2 ? .25 : 1) * (1 + (m.no || 0) * .4) * (st ? 1 : 1.3); });
  const out = []; const used = new Set();
  while (out.length < Math.min(n, pool.length)) { let tot = 0; w.forEach((x, i) => { if (!used.has(i)) tot += x; }); let r = Math.random() * tot; for (let i = 0; i < pool.length; i++) { if (used.has(i)) continue; r -= w[i]; if (r <= 0) { used.add(i); out.push(pool[i]); break; } } }
  return out;
}
function mockSet(n) { // follow the district blueprint proportions, exam IAs only
  const bp = CASE.blueprint, tot = Object.values(bp).reduce((a, b) => a + b, 0); let out = [];
  Object.entries(bp).forEach(([ia, c]) => { const k = Math.max(ia === 'MK' ? 1 : 1, Math.round(c / tot * n)); out = out.concat(shuffle(allQs().filter(q => q.ia === ia)).slice(0, k)); });
  if (out.length < n) out = out.concat(shuffle(allQs().filter(q => q.ia === 'CASE' && !out.includes(q))).slice(0, n - out.length));
  return shuffle(out).slice(0, n);
}
VIEWS.exam = el => {
  const sub = location.hash.split('/')[1];
  if (sub === 'practice') { history.replaceState(null, '', '#exam'); setTimeout(() => runQuiz(weightedPick(10), { title: 'Smart practice', onDone: () => render() }), 50); }
  const ias = Object.keys(CASE.blueprint);
  const stat = ia => { const qs = allQs().filter(q => q.ia === ia); const cs = [...new Set(qs.map(q => q.c))]; const ok = qs.reduce((a, q) => a + ((S.qs[q.id] || {}).ok || 0), 0), no = qs.reduce((a, q) => a + ((S.qs[q.id] || {}).no || 0), 0); return { acc: ok + no ? ok / (ok + no) * 100 : 0, n: ok + no, mast: cs.filter(c => (S.m[c] || {}).s >= 2).length / cs.length * 100 }; };
  const nb = Object.keys(S.notebook).filter(id => allQs().some(q => q.id === id));
  const ex = S.exams.slice(-8).map(e => e.ok / e.n * 100);
  el.innerHTML = `<div class="top"><div><div class="sub">${allQs().length} questions · Finance cluster + case</div><h1>Exam trainer</h1></div></div>
  <div class="grid g3">
    <div class="card hover" id="m1"><div class="k">Smart practice</div><h3 style="margin-top:6px">10 adaptive questions</h3><p class="small muted">Weighted to the district blueprint and your weak spots. Misses come back reworded 4 questions later. Mastered = 2 right in a row.</p></div>
    <div class="card hover" id="m2"><div class="k">Timed mock exam</div><h3 style="margin-top:6px">Blueprint-weighted test</h3><p class="small muted">No feedback until the end. Scored on first try only, like the real thing.</p></div>
    <div class="card hover" id="m3"><div class="k">Mistake notebook</div><h3 style="margin-top:6px">${nb.length} to fix</h3><p class="small muted">Every question you missed and have not mastered since.</p></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>District blueprint vs you <span class="tiny muted">Qs on test</span></h3>${ias.map(ia => { const s = stat(ia); return `<div class="ia" data-ia="${ia}" style="cursor:pointer"><div><div class="row sp small"><span>${IA[ia]}</span><span class="muted tiny">${s.n ? Math.round(s.acc) + '% acc' : 'not tried'}</span></div><div class="bar ${s.mast > 66 ? '' : s.mast > 33 ? 'gold' : 'blue'}" style="margin-top:4px"><i data-w="${s.mast}"></i></div></div><div class="mono small" style="text-align:right">${CASE.blueprint[ia]}</div></div>`; }).join('')}<p class="tiny muted" style="margin-top:8px">Bar = concepts mastered. Tap an area to drill it.</p></div>
    <div class="stack"><div class="card"><h3>Mock exam scores</h3>${sparkSVG(ex, 120, 100)}</div>
      <div class="card"><h3>✨ AI question generator</h3><p class="small muted">Generates 10 new questions in your weakest area so you never run out. Needs your API key.</p><button class="btn sm" id="gen" style="margin-top:10px" ${S.settings.apiKey ? '' : 'disabled'}>Generate 10</button>${S.aiQs.length ? `<span class="tiny muted" style="margin-left:8px">${S.aiQs.length} AI questions in bank</span>` : ''}</div></div>
  </div>`;
  $('#m1').onclick = () => runQuiz(weightedPick(10), { title: 'Smart practice', onDone: () => render() });
  $('#m2').onclick = () => modal(`<h3>Timed mock exam</h3><p class="small muted" style="margin:6px 0 14px">⚠️ The real district exam time is not posted publicly. Confirm with your advisor. Default pace: ${S.settings.examMinPerQ * 60 | 0} sec per question.</p><div class="seg" id="ms"><button data-n="25" class="on">25</button><button data-n="50">50</button><button data-n="100">100</button></div><div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn pri" id="go">Start</button></div>`, (m, close) => { let n = 25; $('#ms', m).onclick = e => { const b = e.target.closest('button'); if (!b) return; n = +b.dataset.n; $$('#ms button', m).forEach(x => x.classList.toggle('on', x === b)); }; $('#go', m).onclick = () => { close(); const set = mockSet(n); runQuiz(set, { mode: 'mock', title: 'Mock exam', timeLimit: Math.round(set.length * S.settings.examMinPerQ * 60), onDone: () => render() }); }; });
  $('#m3').onclick = () => { const qs = shuffle(allQs().filter(q => S.notebook[q.id])); if (!qs.length) return toast('Notebook is empty. Nice.'); runQuiz(qs.slice(0, 15), { title: 'Mistake notebook', onDone: () => render() }); };
  el.addEventListener('click', e => { const r = e.target.closest('[data-ia]'); if (r) runQuiz(weightedPick(10, r.dataset.ia), { title: IA[r.dataset.ia], onDone: () => render() }); });
  $('#gen').onclick = async e => {
    const b = e.target; b.disabled = true; b.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    const weak = Object.keys(CASE.blueprint).map(ia => [ia, stat(ia)]).sort((a, b2) => a[1].mast - b2[1].mast)[0][0];
    try {
      const txt = await ai([{ role: 'user', content: `Write 10 DECA high school Finance cluster exam questions for the instructional area "${IA[weak]}". Mix types: Scenario, Definition, Name the term, Calculation, Which is NOT, True/False. Distractors must be tempting (common mistakes, flipped ratios, look-alike terms). Facts must be accurate as of 2026. Return ONLY JSON array: [{"type":"Scenario","q":"...","correct":"...","wrong":["...","...","..."],"why":"one line"}]. True/False items have exactly one wrong. No em dashes.` }], 'You write accurate, exam-style multiple choice questions. Output valid JSON only.', 2500);
      const arr = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
      const conc = allQs().filter(q => q.ia === weak).map(q => q.c);
      arr.forEach((a, i) => S.aiQs.push({ id: 'ai' + Date.now() + i, ia: weak, c: conc[i % conc.length] || 'tvm', type: a.type || 'Scenario', q: a.q, ch: [a.correct].concat(a.wrong).slice(0, 4), why: a.why || '', l: (CONCEPTS[conc[i % conc.length]] || {}).l, ai: true }));
      save(); toast(`Added ${arr.length} ${IA[weak]} questions`); render();
    } catch (err) { toast('AI error: ' + err.message, 4000); b.disabled = false; b.textContent = 'Generate 10'; }
  };
};

/* ===================== FLASHCARDS (spaced repetition) ===================== */
VIEWS.cards = el => {
  const now = Date.now(); const today = dkey();
  if (S.newCardsDay.d !== today) S.newCardsDay = { d: today, n: 0 };
  const due = CARDS.map((c, i) => i).filter(i => S.cards[i] && S.cards[i].due <= now);
  const fresh = CARDS.map((c, i) => i).filter(i => !S.cards[i]).slice(0, Math.max(0, 12 - S.newCardsDay.n));
  let deck = shuffle(due).concat(fresh), cur = 0;
  const learned = Object.keys(S.cards).length;
  el.innerHTML = `<div class="top"><div><div class="sub">${learned}/${CARDS.length} seen · spaced repetition</div><h1>Flashcards</h1></div><span class="pill ac">${deck.length} today</span></div><div id="fcw"></div>`;
  function draw() {
    const w = $('#fcw'); if (!w) return;
    if (cur >= deck.length) { w.innerHTML = `<div class="card empty"><div style="font-size:48px">🎉</div><h3 style="justify-content:center;margin-top:8px">Done for today</h3><p class="small">Cards come back right before you would forget them.</p><button class="btn sm" id="cram" style="margin-top:12px">Cram all ${CARDS.length} anyway</button></div>`; $('#cram').onclick = () => { deck = shuffle(CARDS.map((c, i) => i)); cur = 0; draw(); }; return; }
    const i = deck[cur], c = CARDS[i];
    w.innerHTML = `<div class="fc" id="fc"><div class="in"><div class="fa">${esc(c[0])}</div><div class="fb2">${esc(c[1])}</div></div></div><p class="tiny muted" style="text-align:center;margin:12px 0">Tap card or press Space to flip · ${cur + 1}/${deck.length}</p><div class="row hide" id="rate" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn sm danger" data-r="0">Again <span class="kbd">1</span></button><button class="btn sm" data-r="1">Hard <span class="kbd">2</span></button><button class="btn sm" data-r="2">Good <span class="kbd">3</span></button><button class="btn sm pri" data-r="3">Easy <span class="kbd">4</span></button></div>`;
    $('#fc').onclick = flip; $('#rate').onclick = e => { const b = e.target.closest('[data-r]'); if (b) rate(+b.dataset.r); };
    anim([$('#fc')], { y: 20, scale: .97 });
  }
  function flip() { $('#fc').classList.toggle('flip'); $('#rate').classList.remove('hide'); }
  function rate(r) {
    const i = deck[cur]; const c = S.cards[i] || { iv: 0, ef: 2.5, n: 0 }; if (!S.cards[i]) S.newCardsDay.n++;
    if (r === 0) { c.n = 0; c.iv = 0; c.ef = Math.max(1.3, c.ef - .2); deck.splice(Math.min(deck.length, cur + 4), 0, i); }
    else { c.n++; c.ef = clamp(c.ef + [0, -.15, 0, .15][r], 1.3, 3); c.iv = c.n === 1 ? (r === 3 ? 3 : 1) : c.n === 2 ? (r === 1 ? 2 : 4) : Math.round(c.iv * c.ef * (r === 1 ? .8 : r === 3 ? 1.3 : 1)); }
    c.due = r === 0 ? Date.now() + 6e4 : startOfDay(Date.now() + c.iv * DAY).getTime() + 3600e3 * 4; S.cards[i] = c; save(); cur++; draw();
  }
  function key(e) { if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) || !$('#fc')) return; if (e.key === ' ') { e.preventDefault(); flip(); } if (e.key >= '1' && e.key <= '4' && !$('#rate').classList.contains('hide')) rate(+e.key - 1); }
  addEventListener('keydown', key); draw();
  return () => removeEventListener('keydown', key);
};

/* ===================== PITCH COACH ===================== */
const SECTIONS = [
  { k: 'opening', n: 'Opening', mins: 1.5, tips: ['Handshake, name, firm', 'One credibility line (years, clients, results)', 'Agenda for the meeting', 'End with a question to start a dialogue'] },
  { k: 'needs', n: 'Assess needs', mins: 2.5, tips: ['4-6 open-ended questions', 'Timeline, income need, family, employees, legacy', 'Paraphrase back what you heard', 'Name their #1 worry'] },
  { k: 'value', n: 'Position value', mins: 3, tips: ['Compare 2-3 exit options side by side', 'Each feature → benefit for THIS client', 'Use their numbers (value, income gap)', 'One visual per idea'] },
  { k: 'solution', n: 'Recommend + objections', mins: 3.5, tips: ['One clear recommendation', 'Why it beats the others for them', 'Address risk (buyer default, taxes, health insurance)', 'Pre-handle 2 objections with LAER'] },
  { k: 'close', n: 'Close + follow-up', mins: 1.5, tips: ['Trial close: "Does this fit?"', 'Summarize in 3 points', 'Specific next step + date', 'Hand over leave-behind'] }
];
const wc = s => (s.trim().match(/\S+/g) || []).length;
VIEWS.pitch = el => {
  const tab = location.hash.split('/')[1] || 'build';
  const P = S.pitch; const words = SECTIONS.reduce((a, s) => a + wc(P[s.k]), 0); const estMin = words / 140;
  el.innerHTML = `<div class="top"><div><div class="sub">Your consultation, built on the rubric</div><h1>Pitch coach</h1></div></div>
  <div class="seg" id="ptab" style="margin-bottom:16px">${[['build', 'Build'], ['run', 'Run 15:00'], ['score', 'Score'], ['drill', 'Q&A drill']].map(t => `<button data-t="${t[0]}" class="${tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div><div id="pv"></div>`;
  $('#ptab').onclick = e => { const b = e.target.closest('button'); if (b) location.hash = 'pitch/' + b.dataset.t; };
  const pv = $('#pv');
  if (tab === 'build') {
    pv.innerHTML = `<div class="card"><h3>Case <span class="pill gold">2026-27</span></h3><p class="small">${esc(CASE.prompt)}</p></div>
    <div class="grid g2" style="margin-top:14px"><div class="card"><label class="f">Real firm you represent (required: research a real company)</label><input type="text" data-p="firm" value="${esc(P.firm)}" placeholder="e.g. Merrill, Edward Jones, a local wealth firm"></div>
    <div class="card"><label class="f">Client persona (fill gaps the case leaves open)</label><textarea data-p="persona" rows="3" placeholder="Name, business type, revenue, employees, family, retirement age goal">${esc(P.persona)}</textarea><div class="row" style="margin-top:8px;gap:6px"><button class="btn sm" id="rp">🎲 Random client</button>${S.settings.apiKey ? '<button class="btn sm ghost" id="aip">✨ AI client</button>' : ''}</div></div></div>
    <div class="card" style="margin-top:14px"><div class="row sp"><div><div class="k">Script length</div><div class="mono" style="font-size:22px;font-weight:700;margin-top:4px" id="wtot">${words} words · ${estMin.toFixed(1)} min</div></div><span class="pill ${estMin > 12.5 ? 'red' : estMin > 9 ? 'ac' : 'gold'}" id="wpill">${estMin > 12.5 ? 'Too long: leave Q&A time' : estMin > 9 ? 'Good: room for questions' : 'Keep building'}</span></div><p class="tiny muted" style="margin-top:6px">Aim for 10-12 min spoken so you leave 2-3 min for judge questions. Estimated at 140 words/min.</p></div>
    <div class="stack" style="margin-top:14px">${SECTIONS.map((s, i) => { const r = CASE.rubric.find(x => x.k === s.k); return `<div class="card"><h3><span class="row"><span class="secdot">${i + 1}</span>${s.n}</span><span class="tiny muted mono" data-wc="${s.k}">${wc(P[s.k])} w · target ~${s.mins} min</span></h3><p class="tiny muted" style="margin-bottom:8px">Rubric: ${esc(r.d)} (${r.max} pts)</p><div class="row wrap" style="gap:6px;margin-bottom:10px">${s.tips.map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div><textarea data-p="${s.k}" rows="6" placeholder="Write it how you would say it out loud...">${esc(P[s.k])}</textarea></div>`; }).join('')}</div>
    <div class="row wrap" style="margin-top:14px"><button class="btn pri" id="ana">🔎 Analyze script</button><button class="btn" id="sver">Save version</button><button class="btn" id="vers">Versions (${(S.versions || []).length})</button><button class="btn" id="lb">📄 Leave-behind</button><button class="btn" id="tele">▶ Teleprompter</button><button class="btn" id="aisc" ${S.settings.apiKey ? '' : 'disabled'}>✨ AI score my script</button><button class="btn ghost" id="cp">Copy script</button></div>`;
    let tt; pv.addEventListener('input', e => { const k = e.target.dataset.p; if (!k) return; P[k] = e.target.value; clearTimeout(tt); tt = setTimeout(() => { save(); const w = SECTIONS.reduce((a, s) => a + wc(P[s.k]), 0), m = w / 140; $('#wtot').textContent = `${w} words · ${m.toFixed(1)} min`; const p = $('#wpill'); p.className = 'pill ' + (m > 12.5 ? 'red' : m > 9 ? 'ac' : 'gold'); p.textContent = m > 12.5 ? 'Too long: leave Q&A time' : m > 9 ? 'Good: room for questions' : 'Keep building'; const c = $(`[data-wc="${k}"]`); if (c) c.textContent = c.textContent.replace(/^\d+ w/, wc(P[k]) + ' w'); }, 300); });
    $('#tele').onclick = teleprompter;
    $('#ana').onclick = scriptAnalyze; $('#sver').onclick = () => { saveVersion(); render(); }; $('#vers').onclick = versionsModal; $('#lb').onclick = leaveBehind; $('#rp').onclick = randomPersona; const ap = $('#aip'); if (ap) ap.onclick = aiPersona;
    $('#cp').onclick = () => { navigator.clipboard.writeText(scriptText()).then(() => toast('Copied')); };
    $('#aisc').onclick = () => aiScore(scriptText(), 'script');
  }
  if (tab === 'run') return runView(pv);
  if (tab === 'score') {
    const last = S.scores[S.scores.length - 1];
    pv.innerHTML = `<div class="card"><h3>Self-score after a practice run</h3><p class="small muted">${esc(CASE.bands)}</p><div class="stack" id="rs" style="margin-top:12px">${CASE.rubric.map(r => `<div><div class="row sp small"><span><b>${r.n}</b> <span class="muted">· ${esc(r.d)}</span></span><b class="mono" id="rv_${r.k}">${last ? last.s[r.k] : Math.round(r.max * .6)}</b></div><input type="range" min="0" max="${r.max}" step="1" value="${last ? last.s[r.k] : Math.round(r.max * .6)}" data-k="${r.k}"></div>`).join('')}</div><div class="row sp" style="margin-top:16px"><div class="big mono" id="rt">0</div><button class="btn pri" id="sv">Save score</button></div></div>
    <div class="card" style="margin-top:14px"><h3>Score history</h3>${sparkSVG(S.scores.map(s => s.total), 130, 100)}<div class="tiny muted">${S.scores.length} scored runs · ✨ = AI judge</div>${S.scores.slice(-5).reverse().map(s => `<div class="row sp small" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${new Date(s.ts).toLocaleDateString()} ${s.src === 'ai' ? '✨' : ''}</span><b class="mono">${s.total}/100</b></div>`).join('')}</div>`;
    const tot = () => { const t = $$('#rs input').reduce((a, i) => a + +i.value, 0); $('#rt').textContent = t + '/100'; return t; };
    pv.addEventListener('input', e => { const k = e.target.dataset.k; if (k) { $('#rv_' + k).textContent = e.target.value; tot(); } }); tot();
    $('#sv').onclick = () => { const s = {}; $$('#rs input').forEach(i => s[i.dataset.k] = +i.value); S.scores.push({ ts: Date.now(), src: 'self', s, total: tot() }); save(); toast('Saved. Lowest items are your next fixes.'); render(); };
  }
  if (tab === 'drill') {
    let q = pick(JUDGE_QS), left = 45, t = null;
    pv.innerHTML = `<div class="card hero" style="text-align:center;padding:28px 18px"><div class="k">The judge asks</div><div id="jq" style="font-size:22px;font-weight:650;margin:14px auto;max-width:560px;line-height:1.4"></div><div class="timer" id="dt" style="font-size:44px">0:45</div><div class="row" style="justify-content:center;margin-top:14px;flex-wrap:wrap"><button class="btn pri" id="ds">Start 45 sec answer</button><button class="btn" id="dn">Next question</button>${S.settings.voice ? '<button class="btn ghost" id="say">🔊 Hear it</button>' : ''}</div></div>
    <div class="card" style="margin-top:14px"><h3>Answer formula (LAER)</h3><ol class="list small"><li><b>Listen</b>: let them finish, nod.</li><li><b>Acknowledge</b>: "That is a fair concern."</li><li><b>Explore</b>: "Is it the buyer, or the payment schedule?"</li><li><b>Respond</b>: fact + benefit + check ("Does that ease it?")</li></ol>${S.settings.apiKey ? '<label class="f" style="margin-top:12px">Type or dictate your answer for AI feedback</label><textarea id="da" rows="3"></textarea><div class="row" style="margin-top:8px"><button class="btn sm" id="mic">🎙 Dictate</button><button class="btn sm" id="dg">✨ Grade answer</button></div><div id="dgo" class="small" style="margin-top:10px;white-space:pre-wrap"></div>' : '<p class="tiny muted" style="margin-top:8px">Add an API key in Settings to get AI feedback on answers.</p>'}</div>`;
    const setQ = () => { $('#jq').textContent = '"' + q + '"'; left = 45; $('#dt').textContent = '0:45'; clearInterval(t); $('#ds').textContent = 'Start 45 sec answer'; if (S.settings.voice) speak(q); };
    setQ();
    $('#dn').onclick = () => { q = pick(JUDGE_QS.filter(x => x !== q)); setQ(); anim(['#jq'], { y: 10 }); };
    $('#ds').onclick = () => { clearInterval(t); left = 45; t = setInterval(() => { left--; $('#dt').textContent = '0:' + String(left).padStart(2, '0'); if (left <= 0) { clearInterval(t); toast('Time. Did you finish with a check-in question?'); } }, 1000); };
    const sy = $('#say'); if (sy) sy.onclick = () => speak(q);
    const mic = $('#mic'); if (mic) mic.onclick = () => dictate($('#da'), mic);
    const dg = $('#dg'); if (dg) dg.onclick = async () => { dg.disabled = true; $('#dgo').innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; try { $('#dgo').textContent = await ai([{ role: 'user', content: `DECA FCE judge question: "${q}". Student answer: "${$('#da').value}". Grade 1-10 for a Solution Recommendation/objection handling rubric item. Give: score, 2 strengths, 2 fixes, and a stronger 2-sentence answer. Short lines, no em dashes.` }], judgeSystem(false), 500); } catch (e) { $('#dgo').textContent = e.message; } dg.disabled = false; };
    return () => clearInterval(t);
  }
};
function scriptText() { const P = S.pitch; return SECTIONS.map(s => `## ${s.n}\n${P[s.k] || ''}`).join('\n\n'); }
function teleprompter() {
  const P = S.pitch; if (!SECTIONS.some(s => P[s.k].trim())) return toast('Write your script first');
  let speed = 40, y = 0, run = false, last = 0, raf;
  const ov = document.createElement('div'); ov.className = 'tele';
  ov.innerHTML = `<div class="scroll"><div class="guide"></div><div class="txt">${SECTIONS.map(s => `<h5>${s.n}</h5>${esc(P[s.k]).replace(/\n/g, '<br>')}`).join('')}<div style="height:50vh"></div></div></div><div class="ctl"><button class="btn pri" id="tp">▶ Play</button><span class="small muted">Speed</span><input type="range" id="ts" min="10" max="120" value="${speed}" style="max-width:180px"><button class="btn sm" id="tm">Mirror</button><span style="flex:1"></span><button class="btn sm ghost" id="tx">Close</button></div>`;
  document.body.appendChild(ov); const txt = $('.txt', ov);
  const loop = t => { if (run) { y += (t - last) / 1000 * speed; const max = txt.scrollHeight - innerHeight * .5; if (y > max) { y = max; run = false; $('#tp', ov).textContent = '▶ Play'; } txt.style.transform = `translateY(${-y}px)${ov._m ? ' scaleX(-1)' : ''}`; } last = t; raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  $('#tp', ov).onclick = () => { run = !run; $('#tp', ov).textContent = run ? '❚❚ Pause' : '▶ Play'; };
  $('#ts', ov).oninput = e => speed = +e.target.value;
  $('#tm', ov).onclick = () => { ov._m = !ov._m; txt.style.transform = `translateY(${-y}px)${ov._m ? ' scaleX(-1)' : ''}`; };
  $('.scroll', ov).addEventListener('wheel', e => { y = Math.max(0, y + e.deltaY); txt.style.transform = `translateY(${-y}px)`; }, { passive: true });
  const close = () => { cancelAnimationFrame(raf); ov.remove(); removeEventListener('keydown', k); };
  const k = e => { if (e.key === ' ') { e.preventDefault(); $('#tp', ov).click(); } if (e.key === 'Escape') close(); };
  addEventListener('keydown', k); $('#tx', ov).onclick = close;
}
function runView(pv) {
  const total = 15 * 60; let left = total, t = null, startT = 0, rec = null, chunks = [], recog = null, words = 0, fillers = 0;
  const segs = [['Setup', .75, '#a98bff']].concat(SECTIONS.map((s, i) => [s.n, s.mins, ['#3ee08f', '#6aa8ff', '#f3c454', '#ff8fa3', '#3ee08f'][i]])).concat([['Judge Q&A', 2.25, '#8a93a8']]);
  pv.innerHTML = `<div class="card" style="text-align:center"><div class="k">Full run</div><div class="timer" id="rt">15:00</div><div class="small" id="rseg" style="color:var(--ac);font-weight:650;height:20px"></div><div class="seglist" style="margin:16px 0 6px">${segs.map(s => `<i style="flex:${s[1]};background:${s[2]};opacity:.35" title="${s[0]}"></i>`).join('')}</div><div class="row sp tiny muted"><span>0:00</span><span>15:00</span></div>
    <div class="row" style="justify-content:center;margin-top:18px;flex-wrap:wrap"><button class="btn pri" id="rgo">▶ Start</button><button class="btn" id="rrec">🎙 Record audio</button><button class="btn" id="rvid">🎥 Video</button><button class="btn ghost" id="rtele">Teleprompter</button></div>
    <div class="grid g3" style="margin-top:16px;text-align:left"><div class="card"><div class="k">Pace</div><b class="mono" id="wpm" style="font-size:22px">-</b> <span class="tiny muted">wpm (aim 130-160)</span></div><div class="card"><div class="k">Filler words</div><b class="mono" id="fil" style="font-size:22px">-</b> <span class="tiny muted">um, uh, like</span></div><div class="card"><div class="k">Runs logged</div><b class="mono" style="font-size:22px">${S.runs.length}</b></div></div>
    <div id="rplay" style="margin-top:14px"></div><p class="tiny muted" style="margin-top:10px">Pace and filler counting use your browser's speech recognition (Chrome and Safari). Audio stays on your device.</p></div>`;
  const segAt = el => { let acc = 0; for (const s of segs) { acc += s[1] * 60; if (el < acc) return s; } return segs[segs.length - 1]; };
  const tick = () => { left = Math.max(0, total - Math.round((Date.now() - startT) / 1000)); const el = total - left; $('#rt').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); $('#rt').style.color = left < 60 ? 'var(--red)' : left < 180 ? 'var(--gold)' : ''; const s = segAt(el); $('#rseg').textContent = 'Now: ' + s[0]; let acc = 0; $$('.seglist i').forEach((b, i) => { acc += segs[i][1] * 60; b.style.opacity = el >= acc ? 1 : el >= acc - segs[i][1] * 60 ? .8 : .35; }); if (words && el > 10) $('#wpm').textContent = Math.round(words / (el / 60)); if (!left) stop(); };
  function stop() { clearInterval(t); t = null; const used = total - left; if (used > 30) { S.runs.push({ ts: Date.now(), sec: used }); save(); toast(`Run logged: ${Math.floor(used / 60)}:${String(used % 60).padStart(2, '0')}. Now score it.`); } $('#rgo').textContent = '▶ Start'; if (recog) { try { recog.stop(); } catch (e) { } recog = null; } }
  $('#rgo').onclick = () => {
    if (t) return stop(); startT = Date.now(); left = total; words = 0; fillers = 0; t = setInterval(tick, 250); $('#rgo').textContent = '■ Stop';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) { recog = new SR(); recog.continuous = true; recog.interimResults = false; recog.lang = 'en-US'; recog.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { const tx = e.results[i][0].transcript.toLowerCase(); words += wc(tx); fillers += (tx.match(/\b(um+|uh+|like|you know|basically|literally)\b/g) || []).length; $('#fil').textContent = fillers; } }; recog.onend = () => { if (t && recog) try { recog.start(); } catch (e) { } }; try { recog.start(); } catch (e) { } }
  };
  $('#rrec').onclick = async () => {
    if (rec && rec.state === 'recording') { rec.stop(); return; }
    try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks = []; rec = new MediaRecorder(st); rec.ondataavailable = e => chunks.push(e.data); rec.onstop = () => { st.getTracks().forEach(x => x.stop()); const url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })); $('#rplay').innerHTML = `<audio controls src="${url}" style="width:100%"></audio><a class="btn sm" download="fce-run.webm" href="${url}" style="margin-top:8px">Download</a>`; $('#rrec').textContent = '🎙 Record audio'; }; rec.start(); $('#rrec').textContent = '■ Stop recording'; toast('Recording. Audio never leaves your device.'); }
    catch (e) { toast('Mic blocked. Allow microphone access.'); }
  };
  $('#rtele').onclick = teleprompter; $('#rvid').onclick = videoPractice;
  return () => { stop(); if (rec && rec.state === 'recording') rec.stop(); };
}

/* ===================== AI JUDGE ===================== */
async function ai(messages, system, max_tokens = 800) {
  const k = S.settings.apiKey; if (!k) throw new Error('Add your API key in Settings');
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: S.settings.model, max_tokens, system, messages }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
  return (j.content || []).map(c => c.text || '').join('').trim();
}
function judgeSystem(roleplay = true, hard = false) {
  const persona = S.pitch.persona.trim() || 'Pat Morgan, 58, owns Morgan Heating & Air (HVAC), 22 employees, about $3.2M revenue and $480k seller discretionary earnings, married, one adult daughter in a different career, wants to retire around 62, worried about employees and having enough income.';
  return roleplay ? `You are role-playing a DECA Financial Consulting (FCE) judge acting as the client. Client: ${persona} The student is a financial consultant${S.pitch.firm ? ' from ' + S.pitch.firm : ''}. Case: ${CASE.prompt}
Rules: stay in character as the client. Answer needs-assessment questions with realistic detail. Keep replies to 1-4 sentences like a real meeting. ${hard ? 'Be skeptical: push back with tough objections (buyer default, taxes, family pressure, timing, fees) and do not accept vague answers.' : 'Raise one realistic concern every few turns.'} Never coach the student while in character. Never use em dashes.` : 'You are an experienced DECA Financial Consulting judge. Be specific, honest and concise. Never use em dashes.';
}
function speak(t) { if (!('speechSynthesis' in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.rate = 1.02; speechSynthesis.speak(u); }
function dictate(ta, btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return toast('Dictation not supported in this browser. Use your keyboard mic.');
  const r = new SR(); r.lang = 'en-US'; r.interimResults = true; const base = ta.value ? ta.value + ' ' : '';
  r.onresult = e => { ta.value = base + [...e.results].map(x => x[0].transcript).join(''); ta.dispatchEvent(new Event('input')); };
  r.onend = () => btn.textContent = '🎙 Dictate'; btn.textContent = '● Listening...'; r.start();
}
async function aiScore(text, kind) {
  if (!text.trim()) return toast('Nothing to score yet');
  const close = modal(`<h3>✨ AI judge scoring</h3><div id="aso" style="margin-top:14px"><span class="typing"><i></i><i></i><i></i></span> <span class="small muted">Reading against the 2026-27 rubric...</span></div>`);
  const rub = CASE.rubric.map(r => `${r.k}: ${r.n} (0-${r.max}) ${r.d}`).join('\n');
  try {
    const out = await ai([{ role: 'user', content: `Score this FCE ${kind === 'script' ? 'presentation script' : 'mock consultation transcript'} on the official 2026-27 rubric. Be a strict but fair district judge. ${CASE.bands}\nRubric keys:\n${rub}\n\n${kind === 'script' ? 'Technique items (org, eff, deliv, design, impr) can only be estimated from a script; estimate conservatively.' : ''}\nReturn ONLY JSON: {"scores":{"opening":n,"needs":n,"value":n,"solution":n,"close":n,"org":n,"eff":n,"deliv":n,"design":n,"impr":n},"strengths":["..",".."],"fixes":["..","..",".."],"missed":["concepts or questions a top competitor would include"],"best_line":"..."}\n\n${text}` }], judgeSystem(false), 1200);
    const j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
    const s = {}; let total = 0; CASE.rubric.forEach(r => { s[r.k] = clamp(Math.round(+j.scores[r.k] || 0), 0, r.max); total += s[r.k]; });
    S.scores.push({ ts: Date.now(), src: 'ai', s, total }); save();
    $('#aso').innerHTML = `<div class="row" style="gap:16px">${ringSVG(total, 110, '/100')}<div class="small" style="flex:1">${CASE.rubric.map(r => `<div class="row sp"><span>${r.n}</span><b class="mono">${s[r.k]}/${r.max}</b></div>`).join('')}</div></div>
      <hr><b class="small">Strengths</b><ul class="list small">${(j.strengths || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul><b class="small" style="display:block;margin-top:10px">Fix next</b><ul class="list small">${(j.fixes || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>${(j.missed || []).length ? `<b class="small" style="display:block;margin-top:10px">Top competitors would add</b><ul class="list small">${j.missed.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${j.best_line ? `<p class="small" style="margin-top:10px">💬 Best line: <i>${esc(j.best_line)}</i></p>` : ''}<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn pri" data-close>Done</button></div>`;
    fillRings($('#aso'));
  } catch (e) { $('#aso').innerHTML = `<p style="color:var(--red)" class="small">${esc(e.message)}</p><button class="btn sm" data-close style="margin-top:10px">Close</button>`; }
}
VIEWS.judge = el => {
  const has = !!S.settings.apiKey;
  let msgs = [], hard = false, busy = false;
  el.innerHTML = `<div class="top"><div><div class="sub">Role-play the real meeting</div><h1>AI mock judge</h1></div>${has ? '<span class="pill ac">key connected</span>' : '<span class="pill red">no key</span>'}</div>
  ${has ? '' : `<div class="card" style="margin-bottom:14px"><h3>Connect your API key</h3><p class="small muted">Paste an Anthropic API key in Settings. It stays in this browser only, never in the code or on GitHub. ⚠️ Each mock costs a few cents; set a monthly spend limit in your Anthropic console.</p><a class="btn sm pri" href="#settings" style="margin-top:10px">Open Settings</a></div>`}
  <div class="card"><div class="row sp wrap" style="gap:10px;margin-bottom:12px"><div class="seg" id="jm"><button class="on" data-h="0">Normal judge</button><button data-h="1">Hard mode</button></div><div class="row" style="gap:8px"><button class="btn sm" id="jr">New meeting</button><button class="btn sm" id="jsc" disabled>✨ Score me</button></div></div>
  <div class="chat" id="chat"><div class="msg j">${has ? 'You walk in. The client stands up to shake your hand. Start your opening below (type or tap 🎙). The clock is running in your head: 15 minutes.' : 'Offline mode: random judge questions. Add a key for a live client who answers, pushes back and scores you.'}</div></div>
  <div class="row" style="margin-top:12px;gap:8px"><textarea id="ji" rows="2" style="min-height:48px" placeholder="${has ? 'Say your opening...' : 'Practice answering out loud, then tap Next'}"></textarea><div class="stack" style="gap:6px"><button class="btn pri sm" id="js">${has ? 'Send' : 'Next Q'}</button><button class="btn sm" id="jmic">🎙</button></div></div>
  <label class="row small muted" style="margin-top:10px;gap:8px"><input type="checkbox" id="jv" ${S.settings.voice ? 'checked' : ''}> Read judge replies out loud</label></div>`;
  const chat = $('#chat');
  const add = (who, t) => { const d = document.createElement('div'); d.className = 'msg ' + who; d.textContent = t; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; if (window.gsap && !reduced) gsap.from(d, { opacity: 0, y: 8, duration: .3 }); return d; };
  $('#jm').onclick = e => { const b = e.target.closest('button'); if (!b) return; hard = b.dataset.h === '1'; $$('#jm button').forEach(x => x.classList.toggle('on', x === b)); };
  $('#jv').onchange = e => { S.settings.voice = e.target.checked; save(); };
  $('#jr').onclick = () => { msgs = []; chat.innerHTML = '<div class="msg j">New meeting. Start with your opening.</div>'; $('#jsc').disabled = true; };
  $('#jmic').onclick = e => dictate($('#ji'), e.currentTarget);
  const send = async () => {
    if (!has) { add('j', pick(JUDGE_QS)); return; }
    const t = $('#ji').value.trim(); if (!t || busy) return; busy = true; $('#ji').value = ''; add('u', t); msgs.push({ role: 'user', content: t });
    const ty = add('j', ''); ty.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    try { const r = await ai(msgs, judgeSystem(true, hard), 300); msgs.push({ role: 'assistant', content: r }); ty.textContent = r; if (S.settings.voice) speak(r); $('#jsc').disabled = msgs.length < 6; }
    catch (e) { ty.textContent = '⚠️ ' + e.message; msgs.pop(); }
    busy = false; chat.scrollTop = chat.scrollHeight;
  };
  $('#js').onclick = send;
  $('#ji').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  $('#jsc').onclick = () => aiScore(msgs.map(m => (m.role === 'user' ? 'CONSULTANT: ' : 'CLIENT: ') + m.content).join('\n'), 'transcript');
  return () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); };
};

/* ===================== RULES ===================== */
VIEWS.rules = el => {
  el.innerHTML = `<div class="top"><div><div class="sub">2026-27 DECA guidelines, verified Nov 16 2026</div><h1>Rules & checklist</h1></div></div>
  <div class="card hero"><h3>The case <span class="pill gold">Sponsor: ${CASE.sponsor}</span></h3><p>${esc(CASE.prompt)}</p></div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Format</h3>${CASE.timing.map(t => `<div class="row sp small" style="padding:7px 0;border-bottom:1px solid var(--line);gap:16px"><span class="muted">${t[0]}</span><b style="text-align:right">${t[1]}</b></div>`).join('')}<p class="tiny muted" style="margin-top:10px">⚠️ Not published: district exam time limit and whether calculators are allowed. ⚠️ DECA+ lists a "Prepared Entry" component for FCE, but the official 2026-27 guidelines list no written entry or upload. Ask your advisor to confirm both.</p></div>
    <div class="card"><h3>Rubric (100 pts)</h3>${CASE.rubric.map(r => `<div class="row sp small" style="padding:6px 0;border-bottom:1px solid var(--line);gap:10px"><span><b>${r.n}</b><div class="tiny muted">${esc(r.d)}</div></span><b class="mono">${r.max}</b></div>`).join('')}</div>
    <div class="card"><h3>✅ Allowed</h3><ul class="list small">${RULES.allowed.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="card"><h3>⛔ Not allowed</h3><ul class="list small">${RULES.banned.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="card"><h3>District exam blueprint</h3>${Object.entries(CASE.blueprint).map(([k, v]) => `<div class="ia"><div><div class="small">${IA[k]}</div><div class="bar" style="margin-top:4px"><i data-w="${v / 24 * 100}"></i></div></div><div class="mono small" style="text-align:right">${v}</div></div>`).join('')}</div>
    <div class="card"><h3>Pack list</h3>${RULES.pack.map((p, i) => `<div class="todo ${S.tasks['pk' + i] ? 'done' : ''}" data-pk="${i}"><button class="ck">${ic('check', 14)}</button><div class="tt">${esc(p)}</div></div>`).join('')}</div>
    <div class="card"><h3>Competition morning</h3><ol class="list small">${RULES.dayOf.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
    <div class="card"><h3>Sources</h3><ul class="list small"><li><a href="https://www.deca.org/compete/financial-consulting" target="_blank" rel="noopener">deca.org: Financial Consulting</a></li><li><a href="https://cdn.prod.website-files.com/635c470cc81318fc3e9c1e0e/6a3c771dcc9f1c5e613efc57_HS_PSC_Guidelines.pdf" target="_blank" rel="noopener">PSC Guidelines PDF</a></li><li><a href="https://cdn.prod.website-files.com/635c470cc81318fc3e9c1e0e/6a3c77411732c3dfeb201332_2026-27-HS-DECA-Finance.pdf" target="_blank" rel="noopener">Finance performance indicators</a></li><li><a href="https://cdn.prod.website-files.com/635c470cc81318fc3e9c1e0e/67c1d710e252d5f3c3e2087d_24-25_Finance%20District%20Exam.pdf" target="_blank" rel="noopener">Sample district Finance exam</a></li><li><a href="https://www.decadirect.org/articles/deca-announces-competitive-event-topics-and-updates-for-2026-2027" target="_blank" rel="noopener">2026-27 topic + reading list</a></li><li><a href="https://californiadeca.org/conferences/" target="_blank" rel="noopener">California DECA conferences</a></li></ul></div>
  </div>`;
  el.addEventListener('click', e => { const r = e.target.closest('[data-pk]'); if (!r) return; const k = 'pk' + r.dataset.pk; if (S.tasks[k]) delete S.tasks[k]; else S.tasks[k] = Date.now(); r.classList.toggle('done'); save(); });
};

/* ===================== MORE (mobile) ===================== */
VIEWS.more = el => {
  el.innerHTML = `<div class="top"><h1>More</h1></div><div class="grid g2">${[['today', 'Dashboard', 'Countdown, readiness, to-do, focus timer'], ['plan', 'Plan', 'The full week-by-week plan'], ['learn', 'All lessons', 'Every story lesson and lab'], ['deck', 'Deck studio', 'Analyze your slides, blueprint, Canva templates'], ['judge', 'AI mock judge', 'Role-play the meeting and get scored'], ['tools', 'Tools', 'Exit calculator, retirement gap, PIs, formulas'], ['play', 'Play', 'Daily challenge, speed round, match, sim'], ['trophies', 'Trophies', 'XP, levels and badges'], ['cards', 'Flashcards', 'Spaced repetition on all key terms'], ['rules', 'Rules & checklist', 'Guidelines, rubric, pack list'], ['settings', 'Settings & sync', 'Date, hours, API key, sync code']].map(x => `<a class="card hover les" href="#${x[0]}" style="text-decoration:none;color:inherit"><div class="em">${ic(x[0], 24)}</div><div><div class="t">${x[1]}</div><div class="small muted">${x[2]}</div></div></a>`).join('')}</div>`;
};

/* ===================== SETTINGS + SYNC ===================== */
function exportable() { const c = JSON.parse(JSON.stringify(S)); c.settings.apiKey = ''; c.settings.gistToken = ''; return c; }
async function toCode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if ('CompressionStream' in window) { const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')); const buf = new Uint8Array(await new Response(cs).arrayBuffer()); return 'FCE1z:' + b64(buf); }
  return 'FCE1:' + b64(bytes);
}
async function fromCode(code) {
  code = code.trim(); let bytes;
  if (code.startsWith('FCE1z:')) { const raw = unb64(code.slice(6)); const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip')); bytes = new Uint8Array(await new Response(ds).arrayBuffer()); }
  else if (code.startsWith('FCE1:')) bytes = unb64(code.slice(5)); else throw new Error('Not an FCE sync code');
  return JSON.parse(new TextDecoder().decode(bytes));
}
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
function unb64(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function applyImport(obj) { const keep = { apiKey: S.settings.apiKey, gistToken: S.settings.gistToken, gistId: S.settings.gistId || obj.settings.gistId, autoSync: S.settings.autoSync }; S = Object.assign(DEFAULT(), obj); S.settings = Object.assign(DEFAULT().settings, obj.settings, keep); localStorage.setItem(KEY, JSON.stringify(S)); }
async function gistPush(silent) {
  const { gistToken: tok, gistId: id } = S.settings; if (!tok) return silent || toast('Add a GitHub token first');
  const body = { description: 'FCE Prep sync', public: false, files: { 'fce-prep.json': { content: JSON.stringify(exportable()) } } };
  try {
    const r = await fetch('https://api.github.com/gists' + (id ? '/' + id : ''), { method: id ? 'PATCH' : 'POST', headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); if (!r.ok) throw new Error(j.message || r.status);
    if (!id) { S.settings.gistId = j.id; localStorage.setItem(KEY, JSON.stringify(S)); }
    S.lastSync = Date.now(); localStorage.setItem(KEY, JSON.stringify(S)); silent || toast('Synced to your private Gist ✓'); if (!silent && route() === 'settings') render();
  } catch (e) { silent || toast('Sync failed: ' + e.message, 4000); }
}
async function gistPull(silent) {
  const { gistToken: tok, gistId: id } = S.settings; if (!tok || !id) return silent || toast('Need token + sync ID');
  try {
    const r = await fetch('https://api.github.com/gists/' + id, { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json' } });
    const j = await r.json(); if (!r.ok) throw new Error(j.message || r.status);
    const f = j.files['fce-prep.json']; let txt = f.content; if (f.truncated) txt = await (await fetch(f.raw_url)).text();
    const obj = JSON.parse(txt);
    if (silent && obj.updated <= S.updated) return;
    applyImport(obj); silent || toast('Pulled latest ✓'); render();
  } catch (e) { silent || toast('Pull failed: ' + e.message, 4000); }
}
VIEWS.settings = el => {
  const st = S.settings;
  el.innerHTML = `<div class="top"><div><div class="sub">Everything saves on this device automatically</div><h1>Settings</h1></div></div>
  <div class="grid g2">
    <div class="card stack"><h3>Event + schedule</h3>
      <div><label class="f">Your name</label><input type="text" data-s="name" value="${esc(st.name)}"></div>
      <div><label class="f">District date (SoCal CDC is listed as Jan 9, 2027)</label><input type="date" data-s="eventDate" value="${esc(st.eventDate)}"></div>
      <div class="grid g2"><div><label class="f">Min hours/week</label><input type="number" data-s="hMin" value="${st.hMin}" min="1" max="20"></div><div><label class="f">Max hours/week</label><input type="number" data-s="hMax" value="${st.hMax}" min="1" max="30"></div></div>
      <div><label class="f">Mock exam seconds per question</label><input type="number" data-s="examMinPerQ" data-mul="60" value="${Math.round(st.examMinPerQ * 60)}" min="15" max="120"></div></div>
    <div class="card stack"><h3>AI (Anthropic API)</h3>
      <p class="small muted">⚠️ Your key is stored only in this browser's localStorage. It is never in the code, never pushed to GitHub and never included in sync codes. Anyone using this device's browser could read it, so don't use a shared computer. Set a spend limit in the Anthropic console.</p>
      <div><label class="f">API key</label><input type="password" data-s="apiKey" value="${esc(st.apiKey)}" placeholder="sk-ant-..." autocomplete="off"></div>
      <div><label class="f">Model</label><select data-s="model">${['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'].map(m => `<option ${m === st.model ? 'selected' : ''}>${m}</option>`).join('')}</select><div class="tiny muted" style="margin-top:4px">Haiku is cheapest, Opus is the toughest judge.</div></div>
      <button class="btn sm" id="tk">Test key</button></div>
    <div class="card stack"><h3>Sync code (manual)</h3><p class="small muted">Copy a code on one device, paste on another. Use it as a backup too: ⚠️ clearing browser data deletes everything that is not synced.</p>
      <div class="row"><button class="btn sm" id="ex">Copy sync code</button><button class="btn sm" id="dlb">Download backup</button></div>
      <textarea id="imc" rows="3" placeholder="Paste a sync code here..."></textarea><button class="btn sm" id="im">Import code</button></div>
    <div class="card stack"><h3>Auto sync (GitHub Gist)</h3><p class="small muted">Free cloud sync to a private Gist in your GitHub. Make a token at github.com/settings/tokens with only the <b>gist</b> scope. Use the same token + sync ID on every device.</p>
      <div><label class="f">GitHub token (gist scope only)</label><input type="password" data-s="gistToken" value="${esc(st.gistToken)}" autocomplete="off"></div>
      <div><label class="f">Sync ID (fills in after first push)</label><input type="text" data-s="gistId" value="${esc(st.gistId)}"></div>
      <label class="row small" style="gap:8px"><input type="checkbox" id="as" ${st.autoSync ? 'checked' : ''}> Auto sync (push after changes, pull on open)</label>
      <div class="row"><button class="btn sm pri" id="gp">Push now</button><button class="btn sm" id="gl">Pull</button></div>${S.lastSync ? `<div class="tiny muted">Last sync ${new Date(S.lastSync).toLocaleString()}</div>` : ''}</div>
    <div class="card stack"><h3>Install on your phone</h3><p class="small muted">iPhone: Safari → Share → Add to Home Screen. It works offline after the first load (AI needs internet).</p></div>
    <div class="card stack"><h3>Danger zone</h3><p class="small muted">Erases all progress on this device.</p><button class="btn sm danger" id="rst">Reset all data</button></div>
  </div>`;
  el.addEventListener('change', e => { const k = e.target.dataset.s; if (!k) return; let v = e.target.type === 'number' ? +e.target.value : e.target.value; if (e.target.dataset.mul) v = v / +e.target.dataset.mul; if (k === 'hMin' || k === 'hMax') v = clamp(v, 1, 30); st[k] = v; if (st.hMin > st.hMax) st.hMax = st.hMin; save(); toast('Saved'); });
  $('#as').onchange = e => { st.autoSync = e.target.checked; save(); };
  $('#tk').onclick = async e => { e.target.disabled = true; try { await ai([{ role: 'user', content: 'Reply with OK' }], 'Reply with OK', 5); toast('✓ Key works'); } catch (err) { toast('✗ ' + err.message, 4000); } e.target.disabled = false; };
  $('#ex').onclick = async () => { const c = await toCode(exportable()); try { await navigator.clipboard.writeText(c); toast(`Copied (${(c.length / 1024).toFixed(1)} KB)`); } catch (e) { $('#imc').value = c; toast('Copy it from the box below'); } };
  $('#dlb').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(exportable(), null, 1)], { type: 'application/json' })); a.download = `fce-backup-${dkey()}.json`; a.click(); };
  $('#im').onclick = async () => { try { const raw = $('#imc').value.trim(); const o = raw.startsWith('{') ? JSON.parse(raw) : await fromCode(raw); modal(`<h3>⚠️ Replace this device's data?</h3><p class="small muted" style="margin-top:6px">The imported progress replaces what is here. Export a code first if you want a backup.</p><div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn pri" id="go">Import</button></div>`, (m, close) => { $('#go', m).onclick = () => { applyImport(o); close(); toast('Imported ✓'); render(); }; }); } catch (e) { toast('Bad code: ' + e.message); } };
  $('#gp').onclick = () => gistPush(false); $('#gl').onclick = () => gistPull(false);
  $('#rst').onclick = () => confirm2('Reset all data?', 'This deletes your plan progress, mastery, scores, script and settings on this device.', () => { localStorage.removeItem(KEY); load(); toast('Reset'); location.hash = 'today'; render(); });
};

/* ---------- boot (after all scripts load) ---------- */
addEventListener('DOMContentLoaded', () => {
buildNav();
render();
tickCd(); setInterval(tickCd, 30000);
if (S.settings.autoSync && S.settings.gistToken && S.settings.gistId) gistPull(true);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
});
