'use strict';
/* =====================================================================
   MISSIONS: one "Continue" button, every session builds your real pitch.
   Research behind each mechanic (see README "Why it works"):
   - One next step, zero choices      -> unclear tasks trigger avoidance
   - Every mission saves a piece of your pitch -> IKEA effect (labor = love, only when finished)
   - Progress starts > 0 and speeds up -> endowed progress + goal gradient
   - Voice reps + "was it as bad as you thought?" -> exposure + expectancy check
   - Bosses get harder each act      -> graded exposure for judge Q&A
   - "When's the next one?" plan     -> implementation intentions (d = .65)
   ===================================================================== */

/* ---------- state ---------- */
function MS() {
  if (!S.ms) S.ms = {};
  return Object.assign(S.ms, Object.assign({ done: {}, cur: null, plan: null, start: 0, reps: [], boss: {}, days: {} }, S.ms));
}

/* ---------- the room: first-mission story (fear of the unknown format) ---------- */
Object.assign(CONCEPTS, {
  room_in: { l: 'room', v: 'icon', d: { e: '🚪', t: 'You walk in' }, c: 'The judge plays your <b>client</b>: a business owner in their late 50s who is starting to plan retirement.' },
  room_flow: { l: 'room', v: 'steps', d: { items: ['Handshake + introduce yourself', 'Set up visuals (clock is running)', 'Consult: open, ask, recommend, close', 'Judge asks questions if time is left'] }, c: 'Every round runs in this <b>same order</b>. No surprises.' },
  room_time: { l: 'room', v: 'stat', d: { n: '15:00', s: 'max, setup included' }, c: 'You get <b>15 minutes</b> total. Setup and judge questions come out of it.' },
  room_score: { l: 'room', v: 'bars', d: { items: [['Open', 15], ['Needs', 15], ['Value', 15], ['Solve', 15], ['Close', 15], ['Style', 25]] }, c: '<b>75 of 100 points</b> are the five parts you will build in these missions.' },
  room_win: { l: 'room', v: 'vs', d: { a: { t: 'Wins points', b: ['Asks questions', 'Uses their numbers', 'One clear pick'] }, b: { t: 'Loses points', b: ['Reading slides', 'Talking at them', 'No next step'] } }, c: 'It is a <b>conversation</b>, not a speech.' },
  room_qa: { l: 'room', v: 'icon', d: { e: '🙋', t: 'Judge questions' }, c: 'Questions are not traps. Use <b>LAER</b>: Listen, Acknowledge, Explore, Respond.' },
  room_2x: { l: 'room', v: 'stat', d: { n: '2x', s: 'presentation vs exam' }, c: 'The <b>presentation</b> counts double the exam. That is why most missions build it.' },
  room_you: { l: 'room', v: 'icon', d: { e: '🧭', t: 'One mission at a time' }, c: 'Each mission builds <b>one piece</b> of your pitch. Finish them all and it is done.' }
});
if (!LESSONS.find(l => l.id === 'room')) LESSONS.unshift({ id: 'room', t: 'Walk Into the Room', e: '🚪', ia: 'CASE', intro: 'Exactly what happens in the 15 minutes.' });

/* ---------- model answers for boss questions (LAER shape) ---------- */
const MODEL = {
  'Why should I trust you with the biggest decision of my life?': 'That is a fair question. I am a fiduciary, which means I am required to put your interests first. Before I recommend anything I want to understand your goals. What matters most to you in this transition?',
  'How do you get paid, and is that a conflict of interest?': 'Great question, and you should always ask it. I charge a flat planning fee that I will put in writing, and as a fiduciary I have to disclose any conflict. Would a written fee summary help?',
  'Why is your firm better than my accountant?': 'Your accountant is key and I want to work with them on the tax side. My role is the full picture: what the business is worth, your exit options and your retirement income. Could we bring them to our next meeting?',
  'My son wants the business but he is not ready. What do I do?': 'That is really common. We could phase the transfer over 3 to 5 years with a manager mentoring him, or sell to him with seller financing so you keep income. What would "ready" look like to you?',
  'I want to retire in 2 years, not 5. Is that realistic?': 'It can be. Buyers pay more for a business that runs without you, so the next 2 years would focus on documenting systems and cleaning up the financials. Is 2 years firm or flexible?',
  'My spouse is nervous about all this. How do I explain it?': 'That is completely understandable. Let us bring them to the next meeting and show the plan in numbers: monthly income, plus health coverage until Medicare at 65. What worries them most?',
  'How do you know what my business is worth?': 'We take your yearly owner earnings, called SDE, times a multiple for your industry, then check it against your assets and recent sales of similar businesses. At $480k SDE and about 2.5 to 3x, that is roughly $1.2 to $1.4 million. Want to walk through the math?',
  'What if the buyer stops paying me?': 'That is a real risk, so we protect you. A solid down payment, a note secured by the business assets, a personal guarantee, and the right to take the business back. Would a bigger down payment make you comfortable?',
  'How much tax will I owe on the sale?': 'It depends on how the deal is built. Long-term capital gains rates are lower than income tax rates, a stock sale usually favors you over an asset sale, and an installment sale spreads the tax over years. I would confirm the exact number with your CPA. Want to see two structures side by side?',
  'Why not just close the doors and sell the equipment?': 'You could, but closing usually only gets the value of equipment and inventory. Selling as a running business gets you paid for the earnings too, often much more, and your employees keep their jobs. Want to see both numbers?',
  'What are the risks of your recommendation?': 'Every option has risk, and you should know them. The main ones are the buyer missing payments, the sale taking longer than planned, and markets dropping after you retire. I have a protection for each. Which one worries you most?',
  'A competitor offered me cash today. Why wait?': 'A cash offer is attractive. Before you accept, let us make sure it is fair: compare it to a real valuation, check the terms, and see if other buyers would compete. Can I look over the offer with you?',
  'What if the market crashes right after I sell?': 'That is called sequence of returns risk. We keep 1 to 2 years of spending in cash and short-term bonds, so you never have to sell investments in a downturn, and we stay diversified. Does a cash cushion make you feel safer?',
  "I don't trust my managers with that kind of money.": 'That is fair. A management buyout does not mean handing over control on day one. We can phase it with seller financing, set milestones, and keep you involved until you are paid in full. What would earn your trust?',
  'What happens to my employees under your plan?': 'Your team matters. A sale to managers or an ESOP keeps them in place, and with an outside buyer we can negotiate terms to keep the staff. Which outcome for them matters most to you?',
  'How long will my money last?': 'With a withdrawal near 4 percent a year, the plan is built to last about 30 years. We will stress test it for inflation and a bad market. Want to see the projection?',
  'What do I do about health insurance before Medicare?': 'Medicare starts at 65. Until then you could use COBRA from your company plan for up to 18 months, a marketplace plan, or a spouse plan. Let us budget it into your income plan. Which sounds closest to your situation?',
  'What is the very first thing I should do this week?': 'Get a professional valuation and pull together 3 years of clean financials. That tells us exactly what we are working with. Can we schedule that review for next week?',
  'An ESOP sounds complicated. Why would I do that?': 'It is more setup. But an ESOP lets you sell to your employees over time, keeps your legacy, and can come with tax advantages. It fits best with steady profits and a solid team. Want to compare it with an outside sale?',
  'I need at least $1.5 million to retire. Can I really get that?': 'Let us check together. Sale proceeds after tax, plus your retirement accounts, plus Social Security. If that adds up, yes. If not, we can phase your exit or use seller financing for steady payments. Shall we run your numbers?'
};

/* ---------- campaign ---------- */
const ACTS = [
  { n: 'I', t: 'The Room', why: 'Know exactly what happens in there' },
  { n: 'II', t: 'Their World', why: 'Ask questions like a real consultant' },
  { n: 'III', t: 'The Numbers', why: 'What the business is worth and how money arrives' },
  { n: 'IV', t: 'The Plan', why: 'Your recommendation and how you defend it' },
  { n: 'V', t: 'Close It', why: 'Seal the deal, then run the whole thing' }
];
const MISSIONS = [
  { id: 'm1', a: 0, t: 'Walk into the room', min: 5, hook: 'See the whole 15 minutes before you ever step in.', builds: null,
    steps: [{ t: 'story', l: 'room', only: Object.keys(CONCEPTS).filter(k => CONCEPTS[k].l === 'room'), n: 'Watch the round' }, { t: 'quiz', cs: ['case_scenario', 'time_limit', 'rubric_split', 'weight_2x'], n: 'Lock it in' }],
    next: 'Next you invent the client you will be talking to.' },
  { id: 'm2', a: 0, t: 'Meet your client', min: 5, hook: 'Build the person across the table.', builds: 'persona',
    steps: [{ t: 'persona', n: 'Build your client' }, { t: 'exam', k: 3, n: 'Exam rep' }],
    next: 'Next: your first 60 seconds. This is where judges decide if they like you.' },
  { id: 'm3', a: 0, t: 'Your first 60 seconds', min: 8, hook: 'Write and say your opening.', builds: 'opening',
    steps: [{ t: 'story', l: 'consult', only: ['opening', 'rapport', 'fiduciary'], n: 'How pros open' }, { t: 'build', sec: 'opening', n: 'Write your opener' }, { t: 'say', sec: 'opening', secs: 60, n: 'Say it out loud' }],
    next: 'Next: your first boss. The judge tests whether to trust you.' },
  { id: 'b1', a: 0, t: 'The Handshake', boss: 'The Wary Owner', lvl: 1, min: 6, hook: 'Three trust questions. Answer out loud.', builds: null,
    steps: [{ t: 'judge', qs: ['Why should I trust you with the biggest decision of my life?', 'How do you get paid, and is that a conflict of interest?', 'Why is your firm better than my accountant?'], n: 'Boss fight' }],
    next: 'Act II: every way an owner can exit a business.' },

  { id: 'm4', a: 1, t: 'Every way out, part 1', min: 6, hook: 'Sell to outsiders, family or managers.', builds: null,
    steps: [{ t: 'story', l: 'exits', only: ['exit_third', 'exit_strategic', 'exit_family', 'exit_mbo'], n: '4 exits' }, { t: 'quiz', cs: ['exit_third', 'exit_strategic', 'exit_family', 'exit_mbo'], n: 'Quiz' }],
    next: 'Next: the 3 exits most competitors forget.' },
  { id: 'm5', a: 1, t: 'Every way out, part 2', min: 6, hook: 'ESOPs, closing down, and timing.', builds: null,
    steps: [{ t: 'story', l: 'exits', only: ['exit_esop', 'exit_liquidate', 'exit_timeline'], n: '3 more exits' }, { t: 'quiz', cs: ['exit_esop', 'exit_liquidate', 'exit_timeline'], n: 'Quiz' }, { t: 'exam', k: 5, n: 'Exam rep' }],
    next: 'Next: the questions that score 15 points on their own.' },
  { id: 'm6', a: 1, t: 'Ask like a pro', min: 9, hook: 'Pick and practice your needs questions.', builds: 'needs',
    steps: [{ t: 'story', l: 'consult', only: ['needs_q', 'active_listen', 'ei_empathy'], n: 'Great questions' }, { t: 'build', sec: 'needs', n: 'Pick your questions' }, { t: 'say', sec: 'needs', secs: 60, n: 'Ask them out loud' }],
    next: 'Boss 2: an owner who does not want to share.' },
  { id: 'b2', a: 1, t: 'The Guarded Owner', boss: 'The Guarded Owner', lvl: 2, min: 7, hook: 'Family, timing and a nervous spouse.', builds: null,
    steps: [{ t: 'judge', qs: ['My son wants the business but he is not ready. What do I do?', 'I want to retire in 2 years, not 5. Is that realistic?', 'My spouse is nervous about all this. How do I explain it?'], n: 'Boss fight' }],
    next: 'Act III: what the business is actually worth.' },

  { id: 'm7', a: 2, t: "What's it worth?", min: 8, hook: 'SDE, EBITDA and multiples, with a slider lab.', builds: null,
    steps: [{ t: 'story', l: 'value', only: ['sde', 'ebitda', 'multiple', 'asset_val'], n: 'Valuation' }, { t: 'lab', k: 'valuation', n: 'Valuation lab' }, { t: 'quiz', cs: ['sde', 'ebitda', 'multiple', 'asset_val', 'dcf'], n: 'Quiz' }],
    next: 'Next: how the money actually reaches your client.' },
  { id: 'm8', a: 2, t: 'How the money arrives', min: 8, hook: 'Cash, seller financing, earnouts.', builds: null,
    steps: [{ t: 'story', l: 'deals', only: ['lumpsum', 'seller_fin', 'earnout', 'seller_risk'], n: 'Deal types' }, { t: 'lab', k: 'installment', n: 'Financing lab' }, { t: 'quiz', cs: ['lumpsum', 'seller_fin', 'earnout', 'seller_risk'], n: 'Quiz' }],
    next: 'Next: keep more of the price, then compare options for your client.' },
  { id: 'm9', a: 2, t: 'Keep more of it', min: 10, hook: 'Taxes, then build your option comparison.', builds: 'value',
    steps: [{ t: 'story', l: 'tax', only: ['ltcg', 'asset_vs_stock', 'installment_tax', 'stepup'], n: 'Taxes' }, { t: 'quiz', cs: ['ltcg', 'asset_vs_stock', 'installment_tax'], n: 'Quiz' }, { t: 'build', sec: 'value', n: 'Compare 3 options' }],
    next: 'Boss 3: a client who only cares about numbers.' },
  { id: 'b3', a: 2, t: 'The Numbers Guy', boss: 'The Numbers Guy', lvl: 3, min: 8, hook: 'Value, payment risk, taxes.', builds: null,
    steps: [{ t: 'judge', qs: ['How do you know what my business is worth?', 'What if the buyer stops paying me?', 'How much tax will I owe on the sale?', 'Why not just close the doors and sell the equipment?'], n: 'Boss fight' }],
    next: 'Act IV: will their money last?' },

  { id: 'm10', a: 3, t: 'Will the money last?', min: 7, hook: 'Retirement plans for owners, with a lab.', builds: null,
    steps: [{ t: 'story', l: 'ret', only: ['k401_limit', 'catchup', 'sep', 'solo401k', 'db_plan'], n: 'Owner plans' }, { t: 'lab', k: 'compound', n: 'Savings lab' }, { t: 'quiz', cs: ['k401_limit', 'catchup', 'sep', 'solo401k', 'db_plan'], n: 'Quiz' }],
    next: 'Next: turn a pile of money into a paycheck for life.' },
  { id: 'm11', a: 3, t: 'A paycheck for life', min: 7, hook: 'Withdrawals, Social Security, Medicare.', builds: null,
    steps: [{ t: 'story', l: 'income', only: ['four_pct', 'ss_fra', 'medicare', 'rmd', 'seq_risk'], n: 'Income' }, { t: 'lab', k: 'withdrawal', n: 'Withdrawal lab' }, { t: 'quiz', cs: ['four_pct', 'ss_fra', 'medicare', 'rmd', 'seq_risk'], n: 'Quiz' }],
    next: 'Next: protect it, then write your recommendation.' },
  { id: 'm12', a: 3, t: 'Make the call', min: 10, hook: 'Protection, then your one recommendation.', builds: 'solution',
    steps: [{ t: 'story', l: 'estate', only: ['buysell', 'keyperson', 'will_trust', 'poa'], n: 'Protection' }, { t: 'quiz', cs: ['buysell', 'keyperson', 'will_trust', 'poa'], n: 'Quiz' }, { t: 'build', sec: 'solution', n: 'Your recommendation' }],
    next: 'Next: pre-handle the pushback before the judge throws it.' },
  { id: 'm13', a: 3, t: 'Handle the pushback', min: 9, hook: 'LAER and feature-benefit, then say it.', builds: 'objections',
    steps: [{ t: 'story', l: 'consult', only: ['laer', 'feat_ben', 'conflict'], n: 'Objections' }, { t: 'build', sec: 'objections', n: 'Pre-handle 2 objections' }, { t: 'say', sec: 'solution', secs: 90, n: 'Say your recommendation' }],
    next: 'Boss 4: The Skeptic. Hard mode.' },
  { id: 'b4', a: 3, t: 'The Skeptic', boss: 'The Skeptic', lvl: 4, min: 9, hook: 'Five tough objections. Hard mode.', builds: null,
    steps: [{ t: 'judge', hard: true, qs: ['What are the risks of your recommendation?', 'A competitor offered me cash today. Why wait?', 'What if the market crashes right after I sell?', "I don't trust my managers with that kind of money.", 'What happens to my employees under your plan?'], n: 'Boss fight' }],
    next: 'Act V: close it.' },

  { id: 'm14', a: 4, t: 'Seal it', min: 9, hook: 'Trial close, summary, next step.', builds: 'close',
    steps: [{ t: 'story', l: 'consult', only: ['trial_close', 'followup'], n: 'Closing' }, { t: 'build', sec: 'close', n: 'Write your close' }, { t: 'say', sec: 'close', secs: 60, n: 'Say it' }, { t: 'exam', k: 5, n: 'Exam rep' }],
    next: 'Next: say the whole pitch top to bottom for the first time.' },
  { id: 'm15', a: 4, t: 'First full read', min: 14, hook: 'Your whole pitch, out loud, timed.', builds: null,
    steps: [{ t: 'say', sec: 'all', secs: 720, n: 'Full run' }],
    next: 'Final boss: the district judge.' },
  { id: 'b5', a: 4, t: 'District Judge', boss: 'The District Judge', lvl: 5, min: 12, hook: 'Six random questions from anywhere. Final boss.', builds: null,
    steps: [{ t: 'judge', hard: true, rand: 6, n: 'Final boss' }, { t: 'exam', k: 10, n: 'Exam gauntlet' }],
    next: 'Campaign done. Endgame: boss rush and full runs every day until districts.' }
];
const PITCH_PARTS = [['persona', 'Client'], ['opening', 'Opening'], ['needs', 'Needs'], ['value', 'Value'], ['solution', 'Plan'], ['close', 'Close']];

/* ---------- progress, pace, chain ---------- */
const mIdx = () => MISSIONS.findIndex(m => !MS().done[m.id]);
const curMission = () => MISSIONS[mIdx()] || null;
function builtParts() { const P = S.pitch; return PITCH_PARTS.filter(([k]) => (P[k] || '').trim().length > 20).length; }
function msPct() {
  // endowed progress: signing up for FCE already counts as step 1 of N+1
  const n = MISSIONS.length + 1, d = Object.keys(MS().done).filter(k => MISSIONS.some(m => m.id === k)).length + 1;
  return d / n * 100;
}
function pace() {
  const ms = MS(); if (!ms.start) { ms.start = Date.now(); save(); }
  const finishBy = eventTs() - 7 * DAY; // leave the final week for full runs
  const left = MISSIONS.length - Object.keys(ms.done).filter(k => MISSIONS.some(m => m.id === k)).length;
  const daysLeft = Math.max(0, (finishBy - Date.now()) / DAY);
  const span = Math.max(1, (finishBy - ms.start) / DAY);
  const shouldBe = clamp(Math.ceil(MISSIONS.length * (1 - daysLeft / span)), 0, MISSIONS.length);
  const doneN = MISSIONS.length - left;
  return { left, daysLeft: Math.ceil(daysLeft), behind: Math.max(0, shouldBe - doneN), perDay: daysLeft > 0 ? left / daysLeft : left };
}
function markDay() { MS().days[dkey()] = (MS().days[dkey()] || 0) + 1; save(); }
function chain() { // one free miss per 7 days so one bad day doesn't erase everything
  const D = MS().days; let n = 0, free = 1, d = Date.now(), seen = 0;
  if (!D[dkey(d)]) d -= DAY;
  while (seen < 400) { seen++; if (D[dkey(d)]) { n++; } else if (free > 0) { free--; } else break; if (n && n % 7 === 0) free = 1; d -= DAY; }
  return n;
}

/* ---------- HOME: the Continue screen ---------- */
VIEWS.go = el => {
  const ms = MS(), m = curMission(), p = pace(), pct = msPct(), ch = chain();
  const resume = ms.cur && m && ms.cur.id === m.id && ms.cur.step > 0;
  const days = Math.ceil((eventTs() - Date.now()) / DAY);
  const plan = ms.plan && ms.plan.ts > Date.now() - DAY ? ms.plan : null;
  const act = m ? ACTS[m.a] : null;
  el.innerHTML = `
  <div class="top"><div><div class="sub">${days} days to districts</div><h1>${m ? 'Your next move' : 'Campaign complete'}</h1></div><div class="row" style="gap:6px">${ch ? `<span class="pill" title="Days with a mission. One free miss per week.">🔗 ${ch}</span>` : ''}<span class="pill ${p.behind ? 'red' : 'ac'}">${p.behind ? p.behind + ' behind' : 'on pace'}</span></div></div>
  ${m ? `<div class="card go-hero ${m.boss ? 'boss' : ''}">
    <div class="k">${m.boss ? '👹 Boss · ' : ''}Act ${act.n} · ${esc(act.t)}</div>
    <div class="go-t">${esc(m.t)}</div>
    <div class="small muted">${esc(m.hook)}</div>
    <div class="row wrap" style="gap:6px;margin-top:12px"><span class="pill">~${m.min} min</span>${m.builds ? `<span class="pill gold">builds: ${esc((PITCH_PARTS.find(x => x[0] === m.builds) || [0, 'objections'])[1])}</span>` : ''}${m.steps.some(s => s.t === 'say' || s.t === 'judge') ? '<span class="pill blue">🎙 voice</span>' : ''}</div>
    <button class="btn pri go-btn" id="go">${resume ? `Resume · step ${ms.cur.step + 1} of ${m.steps.length}` : m.boss ? 'Enter the fight' : 'Continue'} →</button>
    ${plan ? `<div class="tiny muted" style="margin-top:10px;text-align:center">You planned: <b>${esc(plan.label)}</b></div>` : ''}
  </div>` : `<div class="card go-hero"><div class="go-t">Every mission done 🏆</div><p class="small muted">Endgame until districts: one boss rush or one full run a day.</p><div class="row wrap" style="margin-top:14px"><button class="btn pri" id="rush">👹 Boss rush</button><a class="btn" href="#pitch/run">⏱ Full 15:00 run</a><a class="btn" href="#exam">📝 Mock exam</a></div></div>`}

  <div class="card" style="margin-top:14px"><h3>Your pitch <span class="small muted mono">${builtParts()}/${PITCH_PARTS.length} built</span></h3>
    <div class="slots">${PITCH_PARTS.map(([k, n]) => { const on = (S.pitch[k] || '').trim().length > 20; return `<div class="slot ${on ? 'on' : ''}"><i>${on ? '✓' : ''}</i><span>${n}</span></div>`; }).join('')}</div>
    <div class="row sp tiny muted" style="margin-top:12px"><span>Campaign ${Math.round(pct)}%</span><span>${!p.left ? 'All missions done' : p.left + ' missions left'}${p.left && p.daysLeft ? ` · ${p.perDay <= 1 ? '1 every ' + Math.max(1, Math.round(1 / Math.max(p.perDay, .01))) + ' days' : p.perDay.toFixed(1) + ' a day'} keeps you on pace` : ''}</span></div>
    <div class="bar" style="margin-top:6px"><i data-w="${pct}"></i></div>
    ${p.behind >= 3 ? `<p class="small" style="margin-top:12px;color:var(--gold)">⚠️ Cramming the week of won't fit ${p.left} missions plus practice runs. Do 2 today and you're back on track.</p>` : ''}
  </div>

  <div class="stack" style="margin-top:14px">${ACTS.map((A, ai) => { const list = MISSIONS.filter(x => x.a === ai); const dn = list.filter(x => ms.done[x.id]).length; const open = m && m.a === ai; return `<div class="card act ${open ? 'open' : ''}"><h3 data-act="${ai}" style="cursor:pointer"><span>Act ${A.n} · ${esc(A.t)}</span><span class="small muted mono">${dn}/${list.length}</span></h3><div class="act-list" ${open ? '' : 'hidden'}>${list.map(x => { const done = ms.done[x.id], cur = m && x.id === m.id, locked = !done && !cur; return `<button class="mrow ${done ? 'done' : ''} ${cur ? 'cur' : ''} ${locked ? 'lock' : ''}" data-m="${x.id}" ${locked ? 'disabled' : ''}><span class="mdot">${done ? '✓' : x.boss ? '👹' : locked ? '🔒' : '●'}</span><span style="flex:1;text-align:left"><b>${esc(x.t)}</b><span class="tiny muted" style="display:block">${esc(x.hook)}</span></span><span class="tiny muted">${done ? 'replay' : '~' + x.min + 'm'}</span></button>`; }).join('')}</div></div>`; }).join('')}</div>
  <p class="tiny muted" style="text-align:center;margin:18px 0 0">Want free practice instead? Everything else lives in <a href="#more">More</a>.</p>`;
  const go = $('#go'); if (go) go.onclick = () => runMission(m.id);
  const rush = $('#rush'); if (rush) rush.onclick = bossRush;
  el.addEventListener('click', e => {
    const h = e.target.closest('[data-act]'); if (h) { const l = h.nextElementSibling; l.hidden = !l.hidden; }
    const r = e.target.closest('[data-m]'); if (r && !r.disabled) runMission(r.dataset.m);
  });
};

/* ---------- mission runner ---------- */
let RUN = null;
function runMission(id) {
  const m = MISSIONS.find(x => x.id === id); if (!m) return;
  const ms = MS(); if (!ms.start) ms.start = Date.now();
  const replay = !!ms.done[id];
  let step = !replay && ms.cur && ms.cur.id === id ? ms.cur.step : 0;
  const t0 = Date.now();
  const ov = document.createElement('div'); ov.className = 'mx'; document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  RUN = { m, ov };
  const logT = () => addTime(m.boss ? 'pitch' : 'learn', Math.round((Date.now() - t0) / 1000));
  const close = () => { ov.remove(); document.body.style.overflow = ''; RUN = null; logT(); render(); };
  const advance = () => { step++; if (!replay) { ms.cur = { id, step }; save(); } if (step >= m.steps.length) complete(); else draw(true); };
  function head() {
    return `<div class="mx-hd"><button class="btn sm ghost" id="mxx" aria-label="Close">${ic('x', 18)}</button><div class="mx-dots">${m.steps.map((s, i) => `<i class="${i < step ? 'd' : i === step ? 'c' : ''}"></i>`).join('')}</div><span class="tiny muted">${step + 1}/${m.steps.length}</span></div>`;
  }
  function draw(fresh) {
    const s = m.steps[step];
    ov.innerHTML = head() + `<div class="mx-body" id="mxb"></div>`;
    $('#mxx', ov).onclick = () => { if (!replay) { ms.cur = { id, step }; save(); } toast(replay ? 'Closed' : 'Saved. Continue picks up right here.'); close(); };
    const body = $('#mxb', ov);
    STEP[s.t](body, s, advance, m);
    if (fresh && window.gsap && !reduced) gsap.fromTo(body, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .4, ease: 'power2.out' });
  }
  function complete() {
    const first = !ms.done[id];
    ms.done[id] = ms.done[id] || Date.now(); ms.cur = null; markDay(); save();
    if (m.boss) { /* boss result already stored */ }
    const nm = curMission();
    const built = m.builds && m.builds !== 'objections' ? (PITCH_PARTS.find(p => p[0] === m.builds) || [])[1] : m.builds === 'objections' ? 'Objection answers' : null;
    ov.innerHTML = `<div class="mx-hd"><span></span><span class="tiny muted">${m.boss ? 'Boss down' : 'Mission complete'}</span><span></span></div>
    <div class="mx-body" style="text-align:center">
      <div class="mx-big">${m.boss ? '⚔️' : '✅'}</div>
      <h2 class="mx-h">${esc(m.t)} ${m.boss ? 'defeated' : 'done'}</h2>
      ${built ? `<p class="small" style="color:var(--gold)">+ ${esc(built)} added to your real pitch</p>` : ''}
      <div class="slots" style="margin:18px 0">${PITCH_PARTS.map(([k, n]) => { const on = (S.pitch[k] || '').trim().length > 20; return `<div class="slot ${on ? 'on' : ''} ${k === m.builds ? 'new' : ''}"><i>${on ? '✓' : ''}</i><span>${n}</span></div>`; }).join('')}</div>
      <div class="bar"><i data-w="${msPct()}"></i></div><div class="tiny muted" style="margin-top:6px">Campaign ${Math.round(msPct())}%</div>
      ${nm ? `<div class="card" style="margin-top:20px;text-align:left"><div class="k">Up next</div><b>${esc(nm.t)}</b><div class="small muted">${esc(m.next)}</div></div>
      <div class="stack" style="margin-top:14px"><button class="btn pri" id="nx">Keep going: ${esc(nm.t)} (~${nm.min}m) →</button><button class="btn" id="bonus">Quick bonus: 5 exam questions (2m)</button></div>
      <div style="margin-top:20px;text-align:left"><div class="k" style="margin-bottom:8px">Or stop here. When's the next one?</div><div class="row wrap" id="when" style="gap:8px">${['Tonight', 'Tomorrow after school', 'Tomorrow night', 'This weekend'].map(x => `<button class="btn sm" data-w="${x}">${x}</button>`).join('')}</div><div id="ics"></div></div>` : `<div class="stack" style="margin-top:20px"><button class="btn pri" id="dn">Finish</button></div>`}
    </div>`;
    fillRings(ov); confetti();
    if (first && m.boss) toast('Boss cleared · rank ' + (MS().boss[m.id] || '-'));
    const nx = $('#nx', ov); if (nx) nx.onclick = () => { logT(); ov.remove(); RUN = null; runMission(nm.id); };
    const bn = $('#bonus', ov); if (bn) bn.onclick = () => runQuiz(weightedPick(5), { title: 'Bonus reps', onDone: () => toast('Bonus done 💪') });
    const dn = $('#dn', ov); if (dn) dn.onclick = close;
    const wh = $('#when', ov); if (wh) wh.onclick = e => { const b = e.target.closest('[data-w]'); if (!b) return; $$('#when .btn', ov).forEach(x => x.classList.toggle('pri', x === b)); planNext(b.dataset.w, nm, $('#ics', ov), close); };
  }
  draw(true);
}

/* implementation intention: a concrete when, plus an optional calendar event */
function planNext(label, nm, box, close) {
  const d = new Date(); const at = (dd, h, mi = 0) => { const x = new Date(d); x.setDate(x.getDate() + dd); x.setHours(h, mi, 0, 0); return x; };
  let when;
  if (label === 'Tonight') when = d.getHours() >= 20 ? at(0, d.getHours() + 1) : at(0, 20);
  else if (label === 'Tomorrow after school') when = at(1, 15, 30);
  else if (label === 'Tomorrow night') when = at(1, 20);
  else { const k = (6 - d.getDay() + 7) % 7 || 7; when = at(k, 11); }
  MS().plan = { label: label + ' (' + when.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ')', ts: when.getTime() }; save();
  const f = x => x.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const end = new Date(when.getTime() + (nm.min + 5) * 6e4);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FCE Prep//EN', 'BEGIN:VEVENT', 'UID:' + Date.now() + '@fce-prep', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(when), 'DTEND:' + f(end), 'SUMMARY:FCE mission: ' + nm.t.replace(/[,;]/g, ''), 'DESCRIPTION:Open FCE Prep and tap Continue. ~' + nm.min + ' min. https://m14mason.github.io/fce-prep/', 'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:FCE mission', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  box.innerHTML = `<div class="row wrap" style="margin-top:12px;gap:8px"><a class="btn sm" download="fce-mission.ics" href="data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}">📅 Add to calendar</a><button class="btn sm pri" id="ok2">Done for now</button></div><p class="tiny muted" style="margin-top:8px">People who pick a specific time follow through a lot more often than people who just "plan to".</p>`;
  $('#ok2', box).onclick = close;
}

/* ---------- steps ---------- */
const STEP = {};
function stepCard(body, s, icon, title, sub, btn, fn) {
  body.innerHTML = `<div class="mx-step"><div class="mx-big">${icon}</div><div class="k">${esc(s.n || '')}</div><h2 class="mx-h">${title}</h2><p class="small muted">${sub}</p><button class="btn pri go-btn" id="sg">${btn}</button></div>`;
  $('#sg', body).onclick = fn;
}
STEP.story = (body, s, next) => {
  const L = LESSONS.find(l => l.id === s.l);
  const run = () => playLesson(s.l, { only: s.only, done: () => { if (s.l === 'room') { S.lessons.room = Date.now(); save(); } next(); } });
  stepCard(body, s, L ? L.e : '🎬', esc(L ? L.t : 'Lesson'), `${s.only.length} quick scenes, about ${Math.ceil(s.only.length * 7 / 60) || 1} min. Tap to skip ahead.`, 'Watch ▶', run);
  setTimeout(() => { if (RUN && $('#sg', body)) run(); }, 450); // auto-start: no extra tap to begin
};
STEP.quiz = (body, s, next) => {
  const qs = shuffle(s.cs.map(c => shuffle(allQs().filter(q => q.c === c))[0]).filter(Boolean));
  const run = () => runQuiz(qs, { mode: 'learn', title: 'Lock it in', onDone: r => { if (r) next(); } });
  stepCard(body, s, '🎯', 'Lock it in', `${qs.length} questions on what you just saw. Misses come back reworded.`, 'Start quiz', run);
};
STEP.exam = (body, s, next) => {
  const run = () => runQuiz(weightedPick(s.k), { title: 'Exam rep', onDone: r => { if (r) next(); } });
  stepCard(body, s, '📝', 'Exam rep', `${s.k} questions from the real exam blueprint, weighted to your weak spots. The exam is 100 questions, so every rep counts.`, 'Go', run);
};
STEP.lab = (body, s, next) => {
  stepCard(body, s, '🧪', esc(LABS[s.k].t), 'Drag the sliders and watch the numbers move. Use these numbers in your pitch.', 'Open lab', () => openLab(s.k, next));
};

/* client persona builder: chips, no blank page */
STEP.persona = (body, s, next) => {
  const P = S.pitch;
  const opts = {
    biz: ['HVAC company', 'family restaurant', 'landscaping company', 'dental practice', 'auto repair shop', 'bakery with 3 locations'],
    size: [['$1.2M revenue, 8 employees, about $260k owner earnings', 'small'], ['$3.2M revenue, 22 employees, about $480k owner earnings', 'mid'], ['$6M revenue, 40 employees, about $900k owner earnings', 'big']],
    fam: ['an adult son who wants the business but is not ready', 'no kids interested in the business', 'a spouse who co-owns and is nervous', 'a loyal manager who might want to buy'],
    age: ['60', '62', '65'],
    worry: ['taking care of employees', 'having enough income for life', 'paying too much tax', 'keeping the family name on the business']
  };
  const pick = { name: 'Pat Morgan', age: '58', biz: opts.biz[0], size: opts.size[1][0], fam: opts.fam[0], ret: '62', worry: opts.worry[1] };
  const compose = () => `${pick.name}, ${pick.age}, owns a ${pick.biz} with ${pick.size}. Has ${pick.fam}. Wants to retire around ${pick.ret}. Biggest worry: ${pick.worry}.`;
  const chips = (k, list) => `<div class="row wrap chips" data-k="${k}" style="gap:6px">${list.map(v => { const val = Array.isArray(v) ? v[0] : v; return `<button class="chip ${pick[k] === val ? 'on' : ''}" data-v="${esc(val)}">${esc(Array.isArray(v) ? v[1] === 'small' ? 'Small' : v[1] === 'mid' ? 'Mid-size' : 'Large' : v)}</button>`; }).join('')}</div>`;
  body.innerHTML = `<div class="mx-step" style="text-align:left"><div class="k">${esc(s.n)}</div><h2 class="mx-h">Who's across the table?</h2><p class="small muted">Tap to build them. The judge will play this person.</p>
    ${P.persona.trim() ? `<div class="card" style="margin:12px 0"><div class="k">You already have one</div><p class="small">${esc(P.persona)}</p><button class="btn sm" id="keep" style="margin-top:8px">Keep mine →</button></div>` : ''}
    <label class="f">Name</label><input type="text" id="pn" value="${esc(pick.name)}">
    <label class="f" style="margin-top:12px">Business</label>${chips('biz', opts.biz)}
    <label class="f" style="margin-top:12px">Size</label>${chips('size', opts.size)}
    <label class="f" style="margin-top:12px">Family</label>${chips('fam', opts.fam)}
    <label class="f" style="margin-top:12px">Retire at</label>${chips('ret', opts.age)}
    <label class="f" style="margin-top:12px">Biggest worry</label>${chips('worry', opts.worry)}
    <label class="f" style="margin-top:12px">Your firm (a real one you research, like Edward Jones or a local wealth firm)</label><input type="text" id="pf" value="${esc(P.firm)}" placeholder="Firm name">
    <div class="card" style="margin-top:14px"><div class="k">Preview</div><p class="small" id="pv">${esc(compose())}</p></div>
    <button class="btn pri go-btn" id="ok">Lock in client →</button></div>`;
  body.addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; const k = c.parentElement.dataset.k; pick[k] = c.dataset.v; $$('.chip', c.parentElement).forEach(x => x.classList.toggle('on', x === c)); $('#pv', body).textContent = compose(); });
  $('#pn', body).oninput = e => { pick.name = e.target.value.trim() || 'Pat Morgan'; $('#pv', body).textContent = compose(); };
  const keep = $('#keep', body); if (keep) keep.onclick = next;
  $('#ok', body).onclick = () => { if (P.persona.trim() && typeof saveVersion === 'function') saveVersion(); P.persona = compose(); P.firm = $('#pf', body).value.trim(); save(); next(); };
};

/* builders: fill-in templates so you never face a blank page */
const NEEDS_BANK = ['What does a perfect retirement look like for you?', 'When would you ideally like to step away?', 'How much monthly income do you need to feel secure?', 'Who would you like to see running the business after you?', 'How do you feel about your employees in this change?', 'Has anyone in your family shown interest in taking over?', 'Have you ever had the business valued?', 'What worries you most about this transition?', 'How involved do you want to stay after the sale?', 'What does your spouse think about the plan?'];
const BUILD = {
  opening: { t: 'Your opener', fields: [['name', 'Your name', () => S.settings.name || 'Mason'], ['firm', 'Your firm (a real one)', () => S.pitch.firm || 'Your Firm'], ['cred', 'One credibility line', 'I help business owners plan for life after they sell'], ['agenda', 'Agenda (3 things)', 'your goals, your exit options, and a plan for your income'], ['q', 'Open with a question', 'To start, what made now the right time to think about this?']],
    make: v => `Hi, I'm ${v.name} with ${v.firm}. Thank you for meeting with me. ${v.cred}. Today I'd like to cover ${v.agenda}. ${v.q}` },
  value: { t: 'Compare 3 options', fields: [['a', 'Option 1', 'Sell to an outside buyer'], ['ab', 'What it means for them', 'the most cash up front, around $1.3 million'], ['b', 'Option 2', 'Sell to your managers with seller financing'], ['bb', 'What it means for them', 'steady monthly income and your team stays'], ['c', 'Option 3', 'Close and sell the equipment'], ['cb', 'What it means for them', 'fast, but only the asset value, much less money']],
    make: v => `Let's look at your three main options side by side. First, ${v.a}: ${v.ab}. Second, ${v.b}: ${v.bb}. Third, ${v.c}: ${v.cb}. Based on what you told me matters most, one of these clearly fits better.` },
  solution: { t: 'Your recommendation', fields: [['pick', 'My recommendation', 'sell to your managers with seller financing'], ['why1', 'Why it fits them (1)', 'it gives you monthly income for retirement'], ['why2', 'Why it fits them (2)', 'it protects the employees you care about'], ['risk', 'The main risk', 'the managers could miss payments'], ['fix', 'How you protect them', 'a 25 percent down payment and a note secured by the business']],
    make: v => `My recommendation is to ${v.pick}. Here's why it fits you: ${v.why1}, and ${v.why2}. The main risk is that ${v.risk}, so we protect you with ${v.fix}. How does that sound?` },
  objections: { t: 'Pre-handle 2 objections', sec: 'solution', append: true, fields: [['o1', 'Objection they might raise', 'What if the buyer stops paying me?'], ['a1', 'Your LAER answer', 'That is a fair concern. We protect you with a down payment, a secured note, and the right to take the business back.'], ['o2', 'Second objection', 'Why not just take a cash offer?'], ['a2', 'Your LAER answer', 'A cash offer is attractive. Let us compare it to a real valuation first so you do not leave money on the table.']],
    make: v => `\n\nYou might be wondering, "${v.o1}" ${v.a1}\n\nYou might also ask, "${v.o2}" ${v.a2}` },
  close: { t: 'Your close', fields: [['trial', 'Trial close question', 'Does this plan feel like it fits your goals?'], ['sum', '3-point summary', 'a fair price, steady income, and your team protected'], ['step', 'Specific next step', 'get a professional valuation'], ['date', 'When', 'next Tuesday'], ['leave', 'Leave-behind', 'this one-page summary of your options']],
    make: v => `${v.trial} To sum up, this plan gives you ${v.sum}. The next step is to ${v.step}. Can we schedule that for ${v.date}? I'll leave you with ${v.leave}. Thank you for your time.` }
};
STEP.build = (body, s, next) => {
  if (s.sec === 'needs') return buildNeeds(body, s, next);
  const B = BUILD[s.sec]; const sec = B.sec || s.sec; const v = {};
  B.fields.forEach(f => v[f[0]] = typeof f[2] === 'function' ? f[2]() : f[2]);
  const tidy = () => { Object.keys(v).forEach(k => v[k] = String(v[k]).trim().replace(/[.!]+$/, '')); };
  body.innerHTML = `<div class="mx-step" style="text-align:left"><div class="k">${esc(s.n)}</div><h2 class="mx-h">${esc(B.t)}</h2><p class="small muted">Examples are filled in. Change each one to sound like you. This saves straight into your real pitch.</p>
    <div class="stack" style="margin-top:12px">${B.fields.map(f => `<div><label class="f">${esc(f[1])}</label><input type="text" data-f="${f[0]}" value="${esc(v[f[0]])}"></div>`).join('')}</div>
    <div class="card" style="margin-top:14px"><div class="row sp"><div class="k">How it sounds</div><span class="tiny muted mono" id="wc"></span></div><textarea id="out" rows="6"></textarea><div class="tiny muted" style="margin-top:6px">Edit the full text freely. Read it in your head: does it sound like you talking?</div></div>
    <button class="btn pri go-btn" id="ok">Save to my pitch →</button></div>`;
  const out = $('#out', body), wcEl = $('#wc', body); let edited = false;
  const upd = () => { tidy(); if (!edited) out.value = B.make(v).trim(); wcEl.textContent = wc(out.value) + ' words · ~' + Math.max(1, Math.round(wc(out.value) / 140 * 60)) + 's'; };
  body.addEventListener('input', e => { const k = e.target.dataset.f; if (k) { v[k] = e.target.value.trim(); upd(); } if (e.target === out) { edited = true; upd(); } });
  upd();
  $('#ok', body).onclick = () => {
    const txt = out.value.trim(); if (wc(txt) < 8) return toast('Write a bit more first');
    const P = S.pitch;
    if ((P[sec] || '').trim() && typeof saveVersion === 'function') saveVersion(); // never lose an older draft
    if (s.sec === 'opening' && v.firm && v.firm !== 'Your Firm' && !P.firm) P.firm = v.firm;
    P[sec] = B.append ? ((P[sec] || '').trim() + '\n\n' + txt).trim() : txt; save(); toast('Saved to your pitch ✓'); next();
  };
};
function buildNeeds(body, s, next) {
  const chosen = new Set(NEEDS_BANK.slice(0, 2));
  body.innerHTML = `<div class="mx-step" style="text-align:left"><div class="k">${esc(s.n)}</div><h2 class="mx-h">Pick 4-6 questions</h2><p class="small muted">Needs assessment is 15 points. Open questions get the client talking. Add one of your own.</p>
    <div class="stack" id="nb" style="margin-top:12px">${NEEDS_BANK.map((q, i) => `<button class="opt nq ${chosen.has(q) ? 'right' : ''}" data-i="${i}"><span class="ky">${chosen.has(q) ? '✓' : '+'}</span><span>${esc(q)}</span></button>`).join('')}</div>
    <label class="f" style="margin-top:14px">Your own question</label><input type="text" id="own" placeholder="e.g. What would you miss most about running it?">
    <div class="row sp" style="margin-top:14px"><span class="small muted" id="cnt"></span><button class="btn pri" id="ok">Save to my pitch →</button></div></div>`;
  const cnt = () => { const n = chosen.size + ($('#own', body).value.trim() ? 1 : 0); $('#cnt', body).textContent = n + ' picked'; return n; };
  $('#nb', body).onclick = e => { const b = e.target.closest('.nq'); if (!b) return; const q = NEEDS_BANK[+b.dataset.i]; if (chosen.has(q)) chosen.delete(q); else chosen.add(q); b.classList.toggle('right'); $('.ky', b).textContent = chosen.has(q) ? '✓' : '+'; cnt(); };
  $('#own', body).oninput = cnt; cnt();
  $('#ok', body).onclick = () => {
    if (cnt() < 4) return toast('Pick at least 4');
    const list = [...chosen]; const own = $('#own', body).value.trim(); if (own) list.push(own);
    if ((S.pitch.needs || '').trim() && typeof saveVersion === 'function') saveVersion();
    S.pitch.needs = 'Before I suggest anything, I want to understand your situation.\n' + list.map(q => '- ' + q).join('\n') + '\n(Listen, take notes, then paraphrase back: "So what I am hearing is...")';
    save(); toast('Saved to your pitch ✓'); next();
  };
}

/* ---------- voice: speech recognition helper ---------- */
const FILLERS = /\b(um+|uh+|like|you know|basically|kind of|sort of)\b/gi;
function listener(onText) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return null;
  let r, finalT = '', on = false, failed = false;
  const start = () => {
    r = new SR(); r.lang = 'en-US'; r.interimResults = true; r.continuous = true;
    r.onresult = e => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) finalT += e.results[i][0].transcript + ' '; else interim += e.results[i][0].transcript; } onText(finalT + interim); };
    r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { failed = true; on = false; toast('Mic blocked. You can still do the rep and self-check.', 3500); } };
    r.onend = () => { if (on) { try { r.start(); } catch (e) { } } }; // Safari stops after silence: restart
    try { r.start(); } catch (e) { failed = true; }
  };
  return { start: () => { on = true; finalT = ''; start(); }, stop: () => { on = false; try { r && r.stop(); } catch (e) { } return finalT; }, failed: () => failed };
}
function feelCheck(box, kind, done) { // exposure: compare expectation vs reality, then rehearse the win
  box.innerHTML = `<div class="card" style="margin-top:14px"><div class="k">Honest check</div><p class="small" style="margin:6px 0 10px">Was that easier or harder than you expected?</p><div class="row wrap" style="gap:8px">${[['harder', '😬 Harder'], ['same', '😐 Same'], ['easier', '😌 Easier']].map(x => `<button class="btn sm" data-f="${x[0]}">${x[1]}</button>`).join('')}</div></div>`;
  box.onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; const ms = MS(); ms.reps.push({ ts: Date.now(), k: kind, f: b.dataset.f }); if (ms.reps.length > 300) ms.reps.shift(); save(); const n = ms.reps.length, ez = ms.reps.filter(r => r.f !== 'harder').length; toast(n > 2 ? `${ez} of ${n} reps went as well or better than you expected` : 'Rep logged ✓', 3200); done(); };
}

STEP.say = (body, s, next) => {
  const P = S.pitch; const text = s.sec === 'all' ? SECTIONS.map(x => P[x.k]).filter(Boolean).join('\n\n') : P[s.sec] || '';
  const goalW = s.sec === 'all' ? '10-12 minutes' : Math.round(s.secs / 60 * 10) / 10 + ' min';
  body.innerHTML = `<div class="mx-step" style="text-align:left"><div class="k">${esc(s.n)}</div><h2 class="mx-h">Say it like the judge is in front of you</h2><p class="small muted">Out loud, standing up if you can. Glance at the words, don't read them. Target about ${goalW}.</p>
    <div class="card cue" style="margin-top:12px;max-height:${s.sec === 'all' ? '42vh' : '30vh'};overflow:auto"><p class="small" style="white-space:pre-wrap">${esc(text || 'You have not written this part yet. Say it in your own words anyway.')}</p></div>
    <div style="text-align:center;margin-top:16px"><div class="timer" id="st" style="font-size:44px">0:00</div><button class="mic" id="mic" aria-label="Start">🎙</button><div class="tiny muted" id="sh" style="margin-top:8px">Tap to start</div></div>
    <div id="tr" class="small muted" style="margin-top:10px;min-height:20px"></div><div id="res"></div></div>`;
  let on = false, t0 = 0, ti = null, txt = '';
  const L = listener(t => { txt = t; $('#tr', body).textContent = t.slice(-220); });
  const tick = () => { const sec = Math.round((Date.now() - t0) / 1000); $('#st', body).textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
  $('#mic', body).onclick = () => {
    if (!on) { on = true; t0 = Date.now(); ti = setInterval(tick, 250); $('#mic', body).classList.add('rec'); $('#sh', body).textContent = L ? 'Listening... tap to stop' : 'Recording time... tap to stop'; if (L) L.start(); return; }
    on = false; clearInterval(ti); $('#mic', body).classList.remove('rec'); const fin = L ? (L.stop() || txt) : '';
    const sec = Math.max(1, (Date.now() - t0) / 1000), w = wc(fin), wpm = Math.round(w / (sec / 60)), fil = (fin.match(FILLERS) || []).length;
    if (s.sec === 'all') S.runs.push({ ts: Date.now(), sec: Math.round(sec) });
    $('#sh', body).textContent = 'Tap to go again';
    $('#res', body).innerHTML = `<div class="grid g3" style="margin-top:12px"><div class="card"><div class="k">Time</div><b class="mono">${fmtMin(sec / 60)}</b></div><div class="card"><div class="k">Pace</div><b class="mono">${w > 10 ? wpm + ' wpm' : '-'}</b><div class="tiny muted">aim 130-160</div></div><div class="card"><div class="k">Fillers</div><b class="mono">${w > 10 ? fil : '-'}</b><div class="tiny muted">um, uh, like</div></div></div>${!L || w <= 10 ? '<p class="tiny muted" style="margin-top:8px">No transcript this time (mic off or unsupported), so pace is skipped. The rep still counts.</p>' : wpm > 175 ? '<p class="small" style="color:var(--gold);margin-top:8px">A bit fast. Pause after each key point.</p>' : ''}<div id="fc"></div>`;
    feelCheck($('#fc', body), 'say', next);
  };
};

/* judge boss fight: TTS asks, you answer by voice, LAER check + model answer (+ AI grade if key) */
function laerCheck(t) {
  const x = ' ' + t.toLowerCase() + ' ';
  return [
    ['Acknowledged them', /\b(fair|great question|good question|understand|i hear|makes sense|totally|completely|that's a real|valid|common concern|appreciate)\b/.test(x)],
    ['Used a specific', /\d|percent|million|thousand|years?\b|month|down payment|valuation|ss|sde|esop|cobra|medicare|note\b/.test(x)],
    ['Made it about them', (x.match(/\b(you|your)\b/g) || []).length >= 3],
    ['Checked back in', /\b(does that|would that|how does|what do you think|sound good|make sense|fair\?|is that|would you|what matters|which (one|of)|can we|shall we|want to see)\b/.test(x)]
  ];
}
STEP.judge = (body, s, next, m) => {
  const hard = !!s.hard; const qs = s.rand ? shuffle(JUDGE_QS).slice(0, s.rand) : s.qs.slice();
  const maxHp = qs.length * 4; let hp = maxHp, qi = 0, stars = 0;
  const L = listener(t => { const e = $('#tr', body); if (e) e.textContent = t.slice(-240); });
  const ask = () => {
    const q = qs[qi]; let on = false, t0 = 0, ti = null, txt = '';
    body.innerHTML = `<div class="mx-step boss-fight"><div class="row sp"><div class="k">👹 ${esc(m.boss || 'Judge')}${hard ? ' · hard' : ''}</div><span class="tiny muted">Q ${qi + 1}/${qs.length}</span></div>
      <div class="hp"><i style="width:${hp / maxHp * 100}%"></i></div>
      <div class="judge-q" id="jq">"${esc(q)}"</div>
      <div style="text-align:center"><div class="timer" id="st" style="font-size:38px">0:45</div><button class="mic" id="mic">🎙</button><div class="tiny muted" id="sh" style="margin-top:8px">Tap and answer out loud · 45 sec</div><button class="btn sm ghost" id="rep" style="margin-top:8px">🔊 Hear it again</button></div>
      <div id="tr" class="small muted" style="margin-top:10px;min-height:20px"></div><div id="res"></div></div>`;
    speak(q);
    $('#rep', body).onclick = () => speak(q);
    const tick = () => { const left = Math.max(0, 45 - Math.round((Date.now() - t0) / 1000)); $('#st', body).textContent = '0:' + String(left).padStart(2, '0'); if (!left) stop(); };
    const stop = () => {
      if (!on) return; on = false; clearInterval(ti); $('#mic', body).classList.remove('rec'); const fin = L ? (L.stop() || $('#tr', body).textContent) : '';
      $('#mic', body).disabled = true; $('#sh', body).textContent = '';
      showResult(q, fin);
    };
    $('#mic', body).onclick = () => { if (on) return stop(); if ('speechSynthesis' in window) speechSynthesis.cancel(); on = true; t0 = Date.now(); ti = setInterval(tick, 250); $('#mic', body).classList.add('rec'); $('#sh', body).textContent = 'Answering... tap to finish'; if (L) L.start(); };
  };
  const showResult = async (q, fin) => {
    const heard = wc(fin) > 6; const chk = heard ? laerCheck(fin) : null;
    const res = $('#res', body);
    const finish = got => { stars += got; hp = Math.max(0, hp - got); const bar = $('.hp i', body); if (bar) bar.style.width = hp / maxHp * 100 + '%'; };
    const model = MODEL[q];
    res.innerHTML = `${chk ? `<div class="card" style="margin-top:12px"><div class="k">LAER check</div>${chk.map(c => `<div class="row small" style="gap:8px;margin-top:6px"><span>${c[1] ? '✅' : '⬜'}</span>${c[0]}</div>`).join('')}</div>` : `<div class="card" style="margin-top:12px"><div class="k">Self-check (no transcript)</div>${['Acknowledged them', 'Used a specific', 'Made it about them', 'Checked back in'].map((c, i) => `<label class="row small" style="gap:8px;margin-top:6px"><input type="checkbox" data-sc="${i}"> ${c}</label>`).join('')}</div>`}
      <div id="ai"></div>
      ${model ? `<details class="card" style="margin-top:12px"><summary class="small"><b>See a strong answer</b></summary><p class="small" style="margin-top:8px">${esc(model)}</p></details>` : ''}
      <button class="btn pri go-btn" id="nq">${qi + 1 < qs.length ? 'Next question →' : 'Finish the fight →'}</button>`;
    if (chk) { finish(chk.filter(c => c[1]).length); }
    if (heard && S.settings.apiKey) {
      $('#ai', res).innerHTML = '<div class="small muted" style="margin-top:10px"><span class="typing"><i></i><i></i><i></i></span> Judge is scoring...</div>';
      try {
        const out = await ai([{ role: 'user', content: `Client question: "${q}". Student's spoken answer (speech-to-text, ignore transcription errors): "${fin}". Grade as a ${hard ? 'tough' : 'fair'} DECA FCE district judge. Return ONLY JSON {"score":1-10,"good":"one short line","fix":"one short line","better":"a stronger 2 sentence answer"}. No em dashes.` }], judgeSystem(false), 350);
        const j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
        $('#ai', res).innerHTML = `<div class="card" style="margin-top:12px"><div class="row sp"><div class="k">✨ Judge score</div><b class="mono">${clamp(+j.score || 0, 0, 10)}/10</b></div><p class="small" style="margin-top:6px">👍 ${esc(j.good)}</p><p class="small">🔧 ${esc(j.fix)}</p><p class="small muted" style="margin-top:6px"><i>${esc(j.better)}</i></p></div>`;
      } catch (e) { $('#ai', res).innerHTML = `<p class="tiny muted" style="margin-top:8px">AI score unavailable: ${esc(e.message)}</p>`; }
    }
    $('#nq', res).onclick = () => {
      if (!chk) finish($$('[data-sc]', res).filter(x => x.checked).length);
      qi++; if (qi < qs.length) ask(); else victory();
    };
  };
  const victory = () => {
    const pct = stars / maxHp, rank = pct >= .85 ? 'S' : pct >= .65 ? 'A' : pct >= .45 ? 'B' : 'C';
    const ms = MS(); const prev = ms.boss[m.id]; if (!prev || 'SABC'.indexOf(rank) < 'SABC'.indexOf(prev)) ms.boss[m.id] = rank; save();
    body.innerHTML = `<div class="mx-step" style="text-align:center"><div class="mx-big">${rank === 'S' || rank === 'A' ? '⚔️' : '🛡️'}</div><div class="k">${esc(m.boss || 'Judge')}</div><h2 class="mx-h">${pct >= .45 ? 'BOSS DEFEATED' : 'YOU SURVIVED'}</h2><div class="rank r${rank}">${rank}</div><p class="small muted">${stars}/${maxHp} LAER hits${prev ? ` · best ${ms.boss[m.id]}` : ''}</p><p class="small" style="margin-top:10px">${rank === 'C' ? 'Every rep makes the real room less scary. Replay anytime from the map.' : 'The real judge asks exactly this kind of question. You just answered them out loud.'}</p><div id="fc"></div></div>`;
    feelCheck($('#fc', body), 'judge', next);
  };
  ask();
};

/* endgame: random hard questions, every day */
function bossRush() {
  const fake = { id: 'rush', t: 'Boss rush', boss: 'Boss Rush', steps: [{ t: 'judge', hard: true, rand: 5, n: 'Boss rush' }] };
  const ov = document.createElement('div'); ov.className = 'mx'; document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  const close = () => { ov.remove(); document.body.style.overflow = ''; render(); };
  ov.innerHTML = `<div class="mx-hd"><button class="btn sm ghost" id="mxx">${ic('x', 18)}</button><span class="tiny muted">Boss rush</span><span></span></div><div class="mx-body" id="mxb"></div>`;
  $('#mxx', ov).onclick = close;
  STEP.judge($('#mxb', ov), fake.steps[0], () => { markDay(); close(); }, fake);
}

/* ---------- wire into the app ---------- */
NAV.unshift(['go', 'Continue']);
const _ti = NAV.findIndex(n => n[0] === 'today'); if (_ti > -1) NAV[_ti] = ['today', 'Dashboard'];
MOBILE_NAV.splice(0, MOBILE_NAV.length, 'go', 'pitch', 'exam', 'judge', 'more');
I.go = '<path d="M5 4v16l14-8z"/>';
const _xpBase = xp;
xp = function () { // missions and bosses feed the same XP system
  const b = _xpBase(); const ms = MS();
  const extra = Object.keys(ms.done).length * 80 + Object.keys(ms.boss).length * 70 + ms.reps.length * 15;
  const v = b.xp + extra, lvl = Math.floor(Math.sqrt(v / 60)) + 1, cur = 60 * (lvl - 1) ** 2, nxt = 60 * lvl ** 2;
  return { xp: v, lvl, pct: (v - cur) / (nxt - cur) * 100, nxt: nxt - v };
};
BADGES.push(['🚪', 'In the room', 'Finish mission 1', () => !!MS().done.m1], ['⚔️', 'Boss slayer', 'Beat all 5 bosses', () => ['b1', 'b2', 'b3', 'b4', 'b5'].every(k => MS().done[k])], ['🎙', 'Ten reps', '10 voice reps', () => MS().reps.length >= 10], ['👑', 'S rank', 'Get an S on any boss', () => Object.values(MS().boss).includes('S')]);
