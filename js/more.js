/* FCE Prep, part 2: deck analyzer, templates, tools, games, achievements, script analyzer, command palette. */
'use strict';

/* ---------- shared AI call with tools / documents ---------- */
async function aiCall({ messages, system, max_tokens = 1500, tools, beta }) {
  const k = S.settings.apiKey; if (!k) throw new Error('Add your API key in Settings');
  const h = { 'content-type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  if (beta) h['anthropic-beta'] = beta;
  const body = { model: S.settings.model, max_tokens, system, messages }; if (tools) body.tools = tools;
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: h, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
}
const parseJSON = t => JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
function loadScript(src) { return new Promise((res, rej) => { if ($(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); }); }
const fileB64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
function tabs(id, list, cur) { return `<div class="seg" id="${id}" style="margin-bottom:16px">${list.map(t => `<button data-t="${t[0]}" class="${cur === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>`; }

/* ===================== DECK: analyzer, blueprint, templates ===================== */
const DECK_KEYS = {
  opening: /agenda|today|introduc|about (me|us)|welcome|meet|who we are|purpose/i,
  needs: /goal|need|concern|priorit|situation|current|challenge|question|worr|vision/i,
  value: /option|compare|benefit|value|versus|\bvs\b|pros|cons|trade.?off|advantage/i,
  solution: /recommend|plan|solution|strategy|why this|our approach|proposal/i,
  close: /next step|timeline|action|follow|contact|thank|schedule|sign|start/i
};
const CASE_KEYS = [['Sale / buyer', /sell|sale|buyer|acquir/i], ['Succession / family', /succession|family|heir|child|son|daughter|transfer/i], ['MBO / ESOP', /mbo|management buyout|esop|employee/i], ['Wind down', /liquidat|wind.?down|close/i], ['Valuation', /valuation|ebitda|sde|multiple|worth/i], ['Taxes', /tax|capital gain|installment/i], ['Retirement income', /retire|income|401|sep|ira|social security|4%/i], ['Estate / insurance', /estate|trust|will|insurance|buy.?sell|gift/i], ['Timeline', /year|month|phase|timeline|202\d/i]];
const BLUEPRINT = [
  ['Title', .3, 'opening', 'Your name, firm, client name, one-line promise'],
  ['Agenda', .4, 'opening', '3-4 items; sets up the dialogue'],
  ['Client snapshot', 1.2, 'needs', 'What you learned: business, family, timeline, worries'],
  ['Goals + timeline', 1.2, 'needs', 'Their retirement picture and target date'],
  ['Exit options compared', 2.0, 'value', '3 columns: sell, transfer, wind down'],
  ['The numbers', 1.4, 'value', 'Value estimate, income gap, one clean chart'],
  ['Recommendation', 1.6, 'solution', 'One clear choice and why it beats the others for them'],
  ['Risks + answers', 1.2, 'solution', 'Pre-handle 2-3 objections (default, taxes, health insurance)'],
  ['Roadmap', 1.0, 'solution', '5 phases from today to the exit'],
  ['Next steps', .8, 'close', '3 actions, dates, call to action'],
  ['Thank you', .3, 'close', 'Contact + handout reminder; leave Q&A time']
];
const THEMES = [['navy-gold', 'Navy + Gold', 'Classic wealth-management look'], ['emerald', 'Emerald Light', 'Clean, bright, modern'], ['charcoal', 'Charcoal + Coral', 'Bold editorial contrast']];
VIEWS.deck = el => {
  const tab = location.hash.split('/')[1] || 'analyze';
  el.innerHTML = `<div class="top"><div><div class="sub">Analyze, plan and design your slides</div><h1>Deck studio</h1></div></div>${tabs('dt', [['analyze', 'Analyze'], ['blueprint', 'Blueprint'], ['templates', 'Templates'], ['history', 'History']], tab)}<div id="dv"></div>`;
  $('#dt').onclick = e => { const b = e.target.closest('button'); if (b) location.hash = 'deck/' + b.dataset.t; };
  const dv = $('#dv');
  if (tab === 'analyze') deckAnalyze(dv);
  if (tab === 'blueprint') {
    const tot = BLUEPRINT.reduce((a, b) => a + b[1], 0);
    dv.innerHTML = `<div class="card"><h3>11-slide blueprint <span class="pill ac mono">${tot.toFixed(1)} min talk</span></h3><p class="small muted">Built to the 2026-27 rubric. Leaves ~2.5 min for setup and judge questions inside the 15 minutes.</p><div class="seglist" style="margin-top:12px;height:14px">${BLUEPRINT.map(b => `<i style="flex:${b[1]};background:${{ opening: '#a98bff', needs: '#6aa8ff', value: '#f3c454', solution: '#3ee08f', close: '#ff8fa3' }[b[2]]}"></i>`).join('')}</div></div>
    <div class="grid g2" style="margin-top:14px">${BLUEPRINT.map((b, i) => `<div class="card"><div class="row" style="gap:12px;align-items:flex-start"><img src="templates/preview/${S.deckTheme || 'navy-gold'}-${String(i + 1).padStart(2, '0')}.png" alt="" loading="lazy" style="width:128px;border-radius:8px;border:1px solid var(--line);flex:none"><div><div class="row" style="gap:8px"><b>${i + 1}. ${b[0]}</b></div><div class="tiny muted mono">${b[1]} min · ${CASE.rubric.find(r => r.k === b[2]).n}</div><p class="small" style="margin-top:6px">${b[3]}</p></div></div></div>`).join('')}</div>`;
  }
  if (tab === 'templates') {
    dv.innerHTML = `<div class="card"><h3>Blank design templates</h3><p class="small muted">11 slides each, no text and no names: just the layouts, matched to the blueprint. Import into Canva and fill in your content.</p><ol class="list small" style="margin-top:8px"><li>Download a .pptx below</li><li>Canva → <b>Create a design</b> → <b>Import file</b> → pick the .pptx</li><li>Every shape stays editable. Replace the grey bars with your text.</li></ol><a class="btn sm pri" href="https://canva.link/0vmvwsfebsjpymj" target="_blank" rel="noopener" style="margin-top:12px">Open my Canva template (navy + gold)</a></div>
    <div class="stack" style="margin-top:14px">${THEMES.map(t => `<div class="card"><h3>${t[1]} <span class="small muted">${t[2]}</span></h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px">${Array.from({ length: 11 }, (_, i) => `<img src="templates/preview/${t[0]}-${String(i + 1).padStart(2, '0')}.png" loading="lazy" alt="" style="width:100%;border-radius:6px;border:1px solid var(--line)">`).join('')}</div><div class="row" style="margin-top:12px;flex-wrap:wrap"><a class="btn sm pri" href="templates/fce-template-${t[0]}.pptx" download>Download .pptx</a><button class="btn sm" data-th="${t[0]}">${(S.deckTheme || 'navy-gold') === t[0] ? '✓ Blueprint theme' : 'Use in blueprint'}</button></div></div>`).join('')}</div>`;
    dv.onclick = e => { const b = e.target.closest('[data-th]'); if (b) { S.deckTheme = b.dataset.th; save(); render(); } };
  }
  if (tab === 'history') {
    const H = S.deckRuns || [];
    dv.innerHTML = H.length ? `<div class="card"><h3>Deck score trend</h3>${sparkSVG(H.map(h => h.total), 120, 100)}</div>` + H.slice().reverse().map(h => `<div class="card" style="margin-top:12px"><h3><span>${new Date(h.ts).toLocaleString()}</span><span class="pill ac mono">${h.total}/100</span></h3><p class="small">${esc(h.overall || '')}</p><div class="tiny muted">${esc(h.src)}</div></div>`).join('') : '<div class="card empty">No deck analyses yet.</div>';
  }
};
function deckAnalyze(dv) {
  const has = !!S.settings.apiKey;
  dv.innerHTML = `<div class="card"><h3>Analyze your presentation</h3>
    <label class="f">Paste a share link (Google Slides or Canva view link)</label><div class="row"><input type="text" id="dl" placeholder="https://docs.google.com/presentation/d/... or https://www.canva.com/design/.../view" value="${esc(S.deckLink || '')}"><button class="btn pri" id="dla" ${has ? '' : 'disabled'}>Analyze</button></div>
    <p class="tiny muted" style="margin-top:6px">Link must be set to "Anyone with the link can view". ⚠️ Canva pages are heavy on images, so links can miss detail: <b>a PDF upload is the most accurate.</b></p>
    <hr><label class="f">Or upload a PDF export (best) or slide screenshots</label><input type="file" id="df" accept="application/pdf,image/*" multiple style="font-size:14px">
    ${has ? '' : '<p class="small" style="color:var(--gold);margin-top:10px">Add an API key in Settings for the AI judge score. The quick check below works without one.</p>'}</div>
    <div id="dres" style="margin-top:14px"></div>`;
  $('#dl').onchange = e => { S.deckLink = e.target.value.trim(); save(); };
  $('#dla').onclick = () => { const u = $('#dl').value.trim(); if (!/^https?:\/\//.test(u)) return toast('Paste a full link'); S.deckLink = u; save(); deckAI({ link: u }); };
  $('#df').onchange = async e => {
    const files = [...e.target.files]; if (!files.length) return;
    const pdf = files.find(f => f.type === 'application/pdf');
    if (pdf) { if (pdf.size > 30e6) return toast('⚠️ PDF over 30 MB. Export with "standard" quality.'); const local = await localPDF(pdf); if (has) deckAI({ pdf, local }); }
    else { const imgs = files.filter(f => f.type.startsWith('image/')).slice(0, 20); $('#dres').innerHTML = `<div class="card"><h3>${imgs.length} slide images loaded</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:6px">${imgs.map(f => `<img src="${URL.createObjectURL(f)}" style="width:100%;border-radius:6px">`).join('')}</div></div>`; if (has) deckAI({ imgs }); else toast('Images need the AI judge. Upload a PDF for the offline quick check.'); }
  };
}
async function localPDF(file) {
  const out = $('#dres'); out.innerHTML = '<div class="card"><span class="typing"><i></i><i></i><i></i></span> <span class="small muted">Reading slides on your device...</span></div>';
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise; const slides = [];
    for (let i = 1; i <= Math.min(doc.numPages, 40); i++) {
      const pg = await doc.getPage(i); const tc = await pg.getTextContent(); const text = tc.items.map(t => t.str).join(' ').replace(/\s+/g, ' ').trim();
      const vp = pg.getViewport({ scale: 1 }); const sc = 220 / vp.width; const v2 = pg.getViewport({ scale: sc }); const c = document.createElement('canvas'); c.width = v2.width; c.height = v2.height; await pg.render({ canvasContext: c.getContext('2d'), viewport: v2 }).promise;
      slides.push({ text, words: wc(text), img: c.toDataURL('image/jpeg', .7) });
    }
    const all = slides.map(s => s.text).join(' ');
    const dense = slides.filter(s => s.words > 45).length, avg = Math.round(slides.reduce((a, s) => a + s.words, 0) / slides.length);
    const cover = Object.entries(DECK_KEYS).map(([k, re]) => [k, re.test(all)]);
    const caseCov = CASE_KEYS.map(([n, re]) => [n, re.test(all)]);
    const nums = (all.match(/\$?\d[\d,.]*%?/g) || []).length;
    let q = 100 - dense * 8 - (slides.length > 14 ? (slides.length - 14) * 4 : 0) - (slides.length < 7 ? 15 : 0) - cover.filter(c => !c[1]).length * 6 - caseCov.filter(c => !c[1]).length * 3 - (nums < 3 ? 8 : 0);
    q = clamp(Math.round(q), 0, 100);
    const res = { slides: slides.length, avg, dense, cover, caseCov, nums, q };
    out.innerHTML = `<div class="card"><h3>Quick check (on device, no AI) <span class="pill ${q >= 80 ? 'ac' : q >= 60 ? 'gold' : 'red'} mono">${q}/100</span></h3>
      <div class="g3f" style="margin-top:6px"><div><div class="k">Slides</div><b class="mono" style="font-size:22px">${slides.length}</b><div class="tiny muted">${slides.length > 14 ? '⚠️ too many for 12 min' : slides.length < 7 ? 'thin' : 'good range (9-13)'}</div></div><div><div class="k">Avg words / slide</div><b class="mono" style="font-size:22px">${avg}</b><div class="tiny muted">${dense ? `⚠️ ${dense} slide(s) over 45 words` : 'clean'}</div></div><div><div class="k">Numbers used</div><b class="mono" style="font-size:22px">${nums}</b><div class="tiny muted">${nums < 3 ? '⚠️ add real figures' : 'good: judges like specifics'}</div></div></div>
      <hr><div class="k" style="margin-bottom:6px">Rubric flow found in slide text</div><div class="row wrap" style="gap:6px">${cover.map(c => `<span class="pill ${c[1] ? 'ac' : 'red'}">${c[1] ? '✓' : '✗'} ${CASE.rubric.find(r => r.k === c[0]).n}</span>`).join('')}</div>
      <div class="k" style="margin:12px 0 6px">Case topics covered</div><div class="row wrap" style="gap:6px">${caseCov.map(c => `<span class="pill ${c[1] ? 'blue' : ''}">${c[1] ? '✓' : '·'} ${c[0]}</span>`).join('')}</div>
      <hr><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">${slides.map((s, i) => `<div><img src="${s.img}" style="width:100%;border-radius:6px;border:1px solid ${s.words > 45 ? 'var(--red)' : 'var(--line)'}"><div class="tiny muted mono">${i + 1} · ${s.words}w</div></div>`).join('')}</div>
      <p class="tiny muted" style="margin-top:8px">Text-based check only: it cannot judge colors or images. The AI judge reads the actual slides.</p></div><div id="dai"></div>`;
    return res;
  } catch (e) { out.innerHTML = `<div class="card"><p class="small" style="color:var(--red)">${esc(e.message)}</p></div>`; }
}
async function deckAI({ link, pdf, imgs, local }) {
  let box = $('#dai'); if (!box) { $('#dres').insertAdjacentHTML('beforeend', '<div id="dai"></div>'); box = $('#dai'); }
  box.innerHTML = `<div class="card" style="margin-top:14px"><span class="typing"><i></i><i></i><i></i></span> <span class="small muted">AI judge is reviewing every slide against the 2026-27 rubric...</span></div>`;
  const rub = CASE.rubric.map(r => `${r.k}: ${r.n} (0-${r.max}) ${r.d}`).join('\n');
  const ask = `You are a strict, experienced DECA Financial Consulting (FCE) district judge. Case 2026-27: ${CASE.prompt}
The student will present these slides live in a 15-minute consultation (setup and Q&A included). Judge the DECK: design, structure, content fit to the case and rubric. ${CASE.bands}
Rubric keys:\n${rub}
Estimate content items from what the slides show. Be specific: name slide numbers.
Return ONLY JSON: {"scores":{"opening":n,"needs":n,"value":n,"solution":n,"close":n,"org":n,"eff":n,"deliv":n,"design":n,"impr":n},"slide_count":n,"est_minutes":n,"overall":"2 sentences","slides":[{"n":1,"verdict":"keep|fix|cut","note":"short"}],"strengths":[".."],"fixes":["top 5, most impactful first"],"missing":["case content a top competitor shows"],"design":["visual fixes: contrast, fonts, density, alignment, charts"]}. No em dashes.`;
  try {
    let content, tools, beta, src;
    if (pdf) { content = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await fileB64(pdf) } }, { type: 'text', text: ask }]; src = 'PDF: ' + pdf.name; }
    else if (imgs) { content = []; for (const f of imgs) content.push({ type: 'image', source: { type: 'base64', media_type: f.type, data: await fileB64(f) } }); content.push({ type: 'text', text: `Slides are in order (${imgs.length} images).\n` + ask }); src = imgs.length + ' images'; }
    else {
      let u = link; const g = u.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/); if (g) u = `https://docs.google.com/presentation/d/${g[1]}/export/pdf`;
      content = `Fetch and review this presentation: ${u}\nIf you cannot read the slides, return JSON with "overall":"Could not read the link" and zeros.\n` + ask;
      tools = [{ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 4 }]; beta = 'web-fetch-2025-09-10'; src = 'Link: ' + link;
    }
    const txt = await aiCall({ messages: [{ role: 'user', content }], system: 'You output only valid JSON. Never use em dashes.', max_tokens: 3000, tools, beta });
    const j = parseJSON(txt); const s = {}; let total = 0; CASE.rubric.forEach(r => { s[r.k] = clamp(Math.round(+((j.scores || {})[r.k]) || 0), 0, r.max); total += s[r.k]; });
    if (/could not read/i.test(j.overall || '') && !total) throw new Error('The AI could not open that link. Make it public, or export a PDF and upload it.');
    (S.deckRuns = S.deckRuns || []).push({ ts: Date.now(), src, total, s, overall: j.overall }); save();
    box.innerHTML = `<div class="card" style="margin-top:14px"><div class="row" style="gap:18px;flex-wrap:wrap">${ringSVG(total, 130, 'deck score')}<div style="flex:1;min-width:220px"><p>${esc(j.overall || '')}</p><div class="tiny muted" style="margin-top:6px">${j.slide_count || '?'} slides · ~${j.est_minutes || '?'} min spoken</div></div></div>
      <div class="grid g2" style="margin-top:12px"><div>${CASE.rubric.slice(0, 5).map(r => `<div class="ia"><div><div class="small">${r.n}</div><div class="bar" style="margin-top:4px"><i data-w="${s[r.k] / r.max * 100}"></i></div></div><div class="mono small" style="text-align:right">${s[r.k]}/${r.max}</div></div>`).join('')}</div><div>${CASE.rubric.slice(5).map(r => `<div class="ia"><div><div class="small">${r.n}</div><div class="bar blue" style="margin-top:4px"><i data-w="${s[r.k] / r.max * 100}"></i></div></div><div class="mono small" style="text-align:right">${s[r.k]}/${r.max}</div></div>`).join('')}</div></div>
      <hr><b class="small">Fix first</b><ol class="list small">${(j.fixes || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      ${(j.design || []).length ? `<b class="small" style="display:block;margin-top:10px">Design</b><ul class="list small">${j.design.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${(j.missing || []).length ? `<b class="small" style="display:block;margin-top:10px">Missing vs top competitors</b><ul class="list small">${j.missing.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${(j.strengths || []).length ? `<b class="small" style="display:block;margin-top:10px">Keep</b><ul class="list small">${j.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${(j.slides || []).length ? `<hr><b class="small">Slide by slide</b>${j.slides.map(x => `<div class="row small" style="padding:6px 0;border-bottom:1px solid var(--line);gap:10px;align-items:flex-start"><span class="pill ${x.verdict === 'keep' ? 'ac' : x.verdict === 'cut' ? 'red' : 'gold'}" style="min-width:58px;justify-content:center">${x.n} ${esc(x.verdict || '')}</span><span>${esc(x.note || '')}</span></div>`).join('')}` : ''}</div>`;
    fillRings(box); if (total >= 80) confetti();
  } catch (e) { box.innerHTML = `<div class="card" style="margin-top:14px"><p class="small" style="color:var(--red)">⚠️ ${esc(e.message)}</p><p class="tiny muted">Most reliable path: Canva → Share → Download → PDF Standard, then upload it above.</p></div>`; }
}

/* ===================== TOOLS ===================== */
const PIS = [
  ['FI:062', 'Explain the time value of money', 'tvm'], ['FI:569', 'Explain the need for retirement planning', 'four_pct'], ['FI:572', 'Explain the nature of estate planning', 'will_trust'],
  ['FI:077', 'Explain types of investments', 'stocks_bonds'], ['FI:081', 'Explain the concept of insurance', 'risk_tech'], ['FI:270', 'Explain the need to save and invest', 'compound'],
  ['FI:562', 'Calculate net worth', 'net_worth'], ['FI:065', 'Set financial goals', 'smart_goals'], ['FI:783', 'Make financial decisions', 'decision'], ['FI:336', 'Explain the role of financial institutions', 'fin_inst'],
  ['FI:274', 'Identify sources of securities information', 'sec_info'], ['FI:085', 'Explain the concept of accounting', 'acct_eq'], ['CR:012', 'Explain responsibilities of finance professionals in client service', 'fiduciary'],
  ['PD:213', 'Explain the importance of corporate governance', 'governance'], ['BL:003', 'Explain types of business ownership', 'llc'], ['BL:163', 'Comply with the spirit and intent of laws', 'integrity'],
  ['EI:103', 'Maintain confidentiality', 'confidentiality'], ['EI:030', 'Show empathy for others', 'ei_empathy'], ['CO:017', 'Use active listening', 'active_listen'], ['CO:058', 'Ask relevant questions', 'needs_q'],
  ['CO:061', 'Defend ideas objectively', 'laer'], ['CR:029', 'Build and maintain relationships with customers', 'rapport'], ['EC:065', 'Explain the impact of small business on the economy', 'small_biz'], ['EC:011', 'Explain factors that affect business risk', 'risk_types']
];
const FORMULAS = [['Business value (earnings)', 'SDE or EBITDA x multiple'], ['SDE', 'Net profit + owner pay + interest + D&A + one-time items'], ['EBITDA', 'Net income + interest + taxes + depreciation + amortization'], ['Net worth', 'Assets − liabilities'], ['Accounting equation', 'Assets = Liabilities + Equity'], ['Future value', 'FV = PV x (1 + r)^n'], ['Present value', 'PV = FV ÷ (1 + r)^n'], ['Simple interest', 'I = P x r x t'], ['Rule of 72', 'Years to double = 72 ÷ rate'], ['4% rule', 'Year-1 income = nest egg x 0.04'], ['Nest egg needed', 'Yearly income gap ÷ 0.04 (= gap x 25)'], ['Current ratio', 'Current assets ÷ current liabilities'], ['Gross profit', 'Sales − COGS'], ['Gross margin', 'Gross profit ÷ sales'], ['Net margin', 'Net income ÷ sales'], ['Debt-to-income', 'Monthly debt ÷ monthly gross income'], ['Capital gain', 'Sale price − cost basis'], ['Loan payment', 'P x r ÷ (1 − (1 + r)^−n), r = monthly rate']];
VIEWS.tools = el => {
  const tab = location.hash.split('/')[1] || 'exit';
  el.innerHTML = `<div class="top"><div><div class="sub">Numbers for your pitch and the exam</div><h1>Tools</h1></div></div>${tabs('tt', [['exit', 'Exit calculator'], ['gap', 'Retirement gap'], ['pi', 'PI checklist'], ['formulas', 'Formulas'], ['glossary', 'Glossary']], tab)}<div id="tv"></div>`;
  $('#tt').onclick = e => { const b = e.target.closest('button'); if (b) location.hash = 'tools/' + b.dataset.t; };
  const tv = $('#tv');
  if (tab === 'exit') {
    const v = Object.assign({ sde: 480000, mult: 2.8, assets: 420000, basis: 150000, tax: 30, prem: 20, disc: 30 }, S.exitCalc || {});
    const F = [['sde', 'SDE (owner earnings / yr)', 100000, 2000000, 10000, money], ['mult', 'Market multiple', 1, 6, .1, x => x.toFixed(1) + 'x'], ['assets', 'Net assets if liquidated', 0, 3000000, 10000, money], ['basis', 'Owner cost basis', 0, 1000000, 10000, money], ['tax', 'Combined tax on gain (fed + CA est.)', 15, 40, 1, x => x + '%'], ['prem', 'Strategic buyer premium', 0, 50, 5, x => x + '%'], ['disc', 'Family discount', 0, 60, 5, x => x + '%']];
    tv.innerHTML = `<div class="grid g2"><div class="card stack">${F.map(f => `<div><div class="row sp small"><label>${f[1]}</label><b class="mono" id="x_${f[0]}">${f[5](v[f[0]])}</b></div><input type="range" data-k="${f[0]}" min="${f[2]}" max="${f[3]}" step="${f[4]}" value="${v[f[0]]}"></div>`).join('')}<p class="tiny muted">⚠️ Practice estimates for your pitch, not tax advice. Real deals need a CPA and attorney.</p></div><div class="card" id="xo"></div></div>`;
    const draw = () => {
      const base = v.sde * v.mult, tx = g => Math.max(0, g - v.basis) * v.tax / 100;
      const opts = [
        ['Strategic buyer', base * (1 + v.prem / 100), .06, 'Cash at close', 'Medium: culture change'],
        ['Third-party sale', base, .08, 'Cash at close', 'Low-medium'],
        ['MBO (seller financed)', base * .92, .02, '25% now, rest over 7 yrs + interest', 'High: buyer default'],
        ['ESOP', base, .1, 'Partly financed, slower', 'Medium: setup cost'],
        ['Family transfer', base * (1 - v.disc / 100), .02, 'Often gifts + payments', 'Medium: family dynamics'],
        ['Liquidation', v.assets * .8, .05, 'As assets sell', 'Low value, fast']
      ].map(o => { const fees = o[1] * o[2]; const net = o[1] - fees - tx(o[1] - fees); return { n: o[0], gross: o[1], net, timing: o[3], risk: o[4] }; });
      const mx = Math.max(...opts.map(o => o.net)); const best = opts.reduce((a, b) => b.net > a.net ? b : a);
      $('#xo').innerHTML = `<h3>After fees + tax, to the owner</h3>${opts.map(o => `<div style="margin-bottom:10px"><div class="row sp small"><b>${o.n}</b><b class="mono">${money(o.net)}</b></div><div class="bar ${o === best ? '' : 'blue'}"><i style="width:${o.net / mx * 100}%;transition:width .3s"></i></div><div class="tiny muted">${o.timing} · Risk: ${o.risk}</div></div>`).join('')}<hr><p class="small">Highest cash: <b>${best.n}</b>. Remember the client also cares about employees, legacy and timing, so the best number is not always the best answer. That trade-off is your "Positioning value" story.</p><p class="tiny muted">At 4%, ${money(best.net)} supports about ${money(best.net * .04)}/yr of income.</p>`;
    };
    tv.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; v[k] = +e.target.value; $('#x_' + k).textContent = F.find(f => f[0] === k)[5](v[k]); S.exitCalc = v; save(); draw(); }); draw();
  }
  if (tab === 'gap') {
    const v = Object.assign({ age: 58, ret: 62, need: 120000, ss: 36000, saved: 650000, add: 40000, r: 6, sale: 1100000 }, S.gapCalc || {});
    const F = [['age', 'Current age', 50, 65, 1, x => x], ['ret', 'Retire at', 55, 70, 1, x => x], ['need', 'Income wanted / yr (today $)', 40000, 300000, 5000, money], ['ss', 'Social Security / yr (from 67)', 0, 60000, 1000, money], ['saved', 'Retirement savings now', 0, 3000000, 25000, money], ['add', 'Saved per year until retiring', 0, 150000, 2500, money], ['r', 'Return', 2, 9, .5, x => x + '%'], ['sale', 'Net from selling the business', 0, 4000000, 25000, money]];
    tv.innerHTML = `<div class="grid g2"><div class="card stack">${F.map(f => `<div><div class="row sp small"><label>${f[1]}</label><b class="mono" id="g_${f[0]}">${f[5](v[f[0]])}</b></div><input type="range" data-k="${f[0]}" min="${f[2]}" max="${f[3]}" step="${f[4]}" value="${v[f[0]]}"></div>`).join('')}</div><div class="card" id="go"></div></div>`;
    const draw = () => {
      const yrs = Math.max(0, v.ret - v.age); let egg = v.saved; for (let i = 0; i < yrs; i++) egg = egg * (1 + v.r / 100) + v.add; egg += v.sale;
      const inc = egg * .04, early = v.ret < 67 ? v.need : Math.max(0, v.need - v.ss), late = Math.max(0, v.need - v.ss);
      const gap = late - inc, need25 = late * 25, preMed = v.ret < 65 ? 65 - v.ret : 0;
      $('#go').innerHTML = `<h3>Plan at age ${v.ret}</h3><div class="grid g2"><div><div class="k">Nest egg</div><b class="mono" style="font-size:22px">${money(egg)}</b></div><div><div class="k">Safe income (4%)</div><b class="mono" style="font-size:22px">${money(inc)}</b></div></div>
      <div style="margin-top:14px">${[['Needed after Social Security', late, 'blue'], ['Portfolio can pay', inc, '']].map(b => `<div class="row sp small" style="margin-top:8px"><span>${b[0]}</span><b class="mono">${money(b[1])}</b></div><div class="bar ${b[2]}"><i style="width:${b[1] / Math.max(late, inc, 1) * 100}%;transition:width .3s"></i></div>`).join('')}</div>
      <div class="pill ${gap > 0 ? 'red' : 'ac'}" style="margin-top:14px">${gap > 0 ? `Gap: ${money(gap)}/yr. Needs ${money(need25)} total.` : `Covered with ${money(-gap)}/yr to spare`}</div>
      ${v.ret < 67 ? `<p class="small" style="margin-top:10px">⚠️ Retiring before 67 means ${67 - v.ret} year(s) before full Social Security: the portfolio covers ${money(early)}/yr alone then.</p>` : ''}
      ${preMed ? `<p class="small" style="margin-top:6px">⚠️ ${preMed} year(s) before Medicare: budget for private health insurance.</p>` : ''}
      <p class="tiny muted" style="margin-top:10px">Use these numbers on your "Goals" and "The numbers" slides. Simplified: ignores inflation after retiring and taxes.</p>`;
    };
    tv.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; v[k] = +e.target.value; $('#g_' + k).textContent = F.find(f => f[0] === k)[5](v[k]); S.gapCalc = v; save(); draw(); }); draw();
  }
  if (tab === 'pi') {
    S.pi = S.pi || {}; const done = PIS.filter(p => S.pi[p[0]]).length;
    tv.innerHTML = `<div class="card"><h3>Performance indicators you should explain out loud <span class="pill ac mono">${done}/${PIS.length}</span></h3><p class="small muted">From the official 2026-27 Finance cluster PI list. These show up on the exam, and weaving them into your consultation makes it sound expert. Check one off only when you can explain it in 2 sentences without notes.</p></div>
    <div class="card" style="margin-top:14px">${PIS.map(p => `<div class="todo ${S.pi[p[0]] ? 'done' : ''}" data-pi="${p[0]}"><button class="ck">${ic('check', 14)}</button><div class="tt"><span class="mono tiny muted">${p[0]}</span> ${esc(p[1])}<div class="meta">${esc(CONCEPTS[p[2]].c.replace(/<[^>]+>/g, ''))}</div></div><button class="btn sm ghost" data-see="${p[2]}">▶</button></div>`).join('')}</div>`;
    tv.onclick = e => { const s = e.target.closest('[data-see]'); if (s) { playLesson(CONCEPTS[s.dataset.see].l, { only: [s.dataset.see] }); return; } const r = e.target.closest('[data-pi]'); if (r && e.target.closest('.ck')) { S.pi[r.dataset.pi] = !S.pi[r.dataset.pi]; r.classList.toggle('done'); save(); } };
  }
  if (tab === 'formulas') tv.innerHTML = `<div class="card">${FORMULAS.map(f => `<div class="row sp" style="padding:10px 0;border-bottom:1px solid var(--line);gap:16px;flex-wrap:wrap"><b class="small">${f[0]}</b><span class="mono small" style="color:var(--ac)">${esc(f[1])}</span></div>`).join('')}</div>`;
  if (tab === 'glossary') {
    const items = CARDS.map(c => [c[0], c[1]]).concat(Object.values(CONCEPTS).map(c => [(c.c.match(/<b>(.*?)<\/b>/) || [])[1] || '', c.c.replace(/<[^>]+>/g, '')])).filter(x => x[0]);
    tv.innerHTML = `<div class="card"><input type="text" id="gq" placeholder="Search ${items.length} terms..."><div id="gl" style="margin-top:12px"></div></div>`;
    const draw = q => { q = q.toLowerCase(); $('#gl').innerHTML = items.filter(x => !q || (x[0] + x[1]).toLowerCase().includes(q)).slice(0, 80).map(x => `<div style="padding:9px 0;border-bottom:1px solid var(--line)"><b class="small">${esc(x[0])}</b><div class="small muted">${esc(x[1])}</div></div>`).join('') || '<div class="empty">No match</div>'; };
    $('#gq').oninput = e => draw(e.target.value); draw('');
  }
};

/* ===================== PLAY: games + simulation ===================== */
VIEWS.play = el => {
  const today = dkey(); const dq = dailyQ(); const dd = (S.daily || {})[today];
  el.innerHTML = `<div class="top"><div><div class="sub">Short games that still count toward mastery</div><h1>Play</h1></div><span class="pill gold">⚡ ${xp().xp} XP</span></div>
  <div class="grid g2">
    <div class="card hero"><div class="k">Daily challenge</div><h3 style="margin-top:6px">${dd ? (dd.ok ? '✓ Solved today' : '✗ Missed today') : 'One question, one shot'}</h3><p class="small muted">${dailyStreak()} day challenge streak. Same question for the whole day.</p><button class="btn sm pri" id="dc" style="margin-top:10px" ${dd ? 'disabled' : ''}>${dd ? 'Come back tomorrow' : 'Play'}</button></div>
    <div class="card hover" id="sr"><div class="k">Speed round</div><h3 style="margin-top:6px">60 seconds, 2 choices</h3><p class="small muted">Best: <b class="mono">${S.speedBest || 0}</b>. Fast recall trains the exam pace.</p></div>
    <div class="card hover" id="mg"><div class="k">Match</div><h3 style="margin-top:6px">Term ↔ meaning</h3><p class="small muted">Best time: <b class="mono">${S.matchBest ? S.matchBest.toFixed(1) + 's' : '-'}</b></p></div>
    <div class="card hover" id="op"><div class="k">Opener sprint</div><h3 style="margin-top:6px">30-second opening</h3><p class="small muted">Say your opening out loud. Hit all 4 beats before the buzzer.</p></div>
    <div class="card hover" id="sim"><div class="k">Competition day sim</div><h3 style="margin-top:6px">Exam then pitch</h3><p class="small muted">25 timed questions, then straight into a 15:00 run. Builds stamina for the real day.</p></div>
    <div class="card hover" id="cr"><div class="k">Concept replay</div><h3 style="margin-top:6px">Watch your weak spots</h3><p class="small muted">A story made only of the concepts you have missed most.</p></div>
  </div>`;
  $('#dc').onclick = () => runQuiz([dq], { title: 'Daily challenge', onDone: r => { if (r) { (S.daily = S.daily || {})[today] = { ok: r.first === 1 }; save(); if (r.first) confetti(); } render(); } });
  $('#sr').onclick = speedRound; $('#mg').onclick = matchGame; $('#op').onclick = openerSprint;
  $('#sim').onclick = () => runQuiz(mockSet(25), { mode: 'mock', title: 'Sim: exam', timeLimit: Math.round(25 * S.settings.examMinPerQ * 60), onDone: r => { if (r) { toast('Exam done. Pitch starts now: stand up.', 4000); location.hash = 'pitch/run'; } } });
  $('#cr').onclick = () => { const weak = Object.entries(S.m).filter(([k, m]) => m.no && m.s < 2 && CONCEPTS[k]).sort((a, b) => b[1].no - a[1].no).slice(0, 8).map(x => x[0]); if (!weak.length) return toast('No weak concepts yet. Do some practice first.'); playLesson(CONCEPTS[weak[0]].l, { only: weak, done: () => runQuiz(weak.map(c => shuffle(allQs().filter(q => q.c === c))[0]), { title: 'Replay quiz', onDone: () => render() }) }); };
};
function dailyQ() { const d = dkey(); let h = 0; for (const ch of d) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const qs = QUESTIONS; return qs[h % qs.length]; }
function dailyStreak() { let n = 0, d = Date.now(); const D = S.daily || {}; if (!D[dkey(d)]) d -= DAY; while (D[dkey(d)] && D[dkey(d)].ok) { n++; d -= DAY; } return n; }
function speedRound() {
  let score = 0, left = 60, cur, t; const pool = shuffle(allQs());
  const close = modal(`<div class="row sp"><h3>⚡ Speed round</h3><b class="mono pill gold" id="sl">60</b></div><div id="sq" style="margin-top:14px"></div><div class="row sp" style="margin-top:14px"><span class="small muted">Score <b class="mono" id="ss">0</b></span><button class="btn sm" data-close>Quit</button></div>`, (m, cl) => {
    const next = () => { cur = pool.pop() || shuffle(allQs())[0]; const wrong = cur.ch[1 + (Math.random() * (cur.ch.length - 1) | 0)]; const o = shuffle([[cur.ch[0], 1], [wrong, 0]]); $('#sq', m).innerHTML = `<div class="small" style="font-weight:600;min-height:66px">${esc(cur.q)}</div>${o.map(x => `<button class="opt" data-ok="${x[1]}">${esc(x[0])}</button>`).join('')}`; };
    $('#sq', m).onclick = e => { const b = e.target.closest('.opt'); if (!b) return; const ok = b.dataset.ok === '1'; mark(cur, ok); if (ok) { score++; $('#ss', m).textContent = score; } else { b.classList.add('wrong', 'shake'); left = Math.max(0, left - 3); } setTimeout(next, ok ? 80 : 350); };
    t = setInterval(() => { left--; $('#sl', m).textContent = left; if (left <= 0) { clearInterval(t); const best = score > (S.speedBest || 0); if (best) S.speedBest = score; save(); $('#sq', m).innerHTML = `<div class="empty"><div class="big mono">${score}</div><p>${best ? '🏆 New best!' : 'Best: ' + S.speedBest}</p><p class="tiny muted">Wrong answers cost 3 seconds.</p></div>`; if (best) confetti(); } }, 1000);
    next(); m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) clearInterval(t); }, true);
  });
}
function matchGame() {
  const set = shuffle(CARDS).slice(0, 6); const t0 = Date.now(); let sel = null, done = 0;
  const L = shuffle(set.map((c, i) => [c[0], i])), R = shuffle(set.map((c, i) => [c[1], i]));
  modal(`<div class="row sp"><h3>🧩 Match</h3><span class="tiny muted">Tap a term, then its meaning</span></div><div style="display:grid;grid-template-columns:1fr 1.3fr;margin-top:12px;gap:8px"><div class="stack" style="gap:8px">${L.map(x => `<button class="opt" data-s="L" data-i="${x[1]}" style="font-weight:650">${esc(x[0])}</button>`).join('')}</div><div class="stack" style="gap:8px">${R.map(x => `<button class="opt small" data-s="R" data-i="${x[1]}" style="font-size:13px">${esc(x[0])}</button>`).join('')}</div></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sm" data-close>Close</button></div>`, (m, close) => {
    m.querySelector('.box').style.maxWidth = '720px';
    m.addEventListener('click', e => {
      const b = e.target.closest('.opt[data-s]'); if (!b || b.classList.contains('right')) return;
      if (!sel || sel.dataset.s === b.dataset.s) { if (sel) sel.style.borderColor = ''; sel = b; b.style.borderColor = 'var(--blue)'; return; }
      if (sel.dataset.i === b.dataset.i) { [sel, b].forEach(x => { x.classList.add('right'); x.style.borderColor = ''; }); done++; sel = null; if (done === 6) { const s = (Date.now() - t0) / 1000; const best = !S.matchBest || s < S.matchBest; if (best) S.matchBest = s; save(); toast(`${s.toFixed(1)}s ${best ? '🏆 new best' : ''}`); if (best) confetti(); } }
      else { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); sel.style.borderColor = ''; sel = null; }
    });
  });
}
function openerSprint() {
  let left = 30, t; const beats = ['Greeting + your name + firm', 'One credibility line', 'Agenda (3 items)', 'A question to the client'];
  modal(`<h3>🎤 Opener sprint</h3><div class="timer" id="ol" style="margin:12px 0">0:30</div><div id="ob">${beats.map((b, i) => `<div class="todo" data-b="${i}"><button class="ck">${ic('check', 14)}</button><div class="tt">${b}</div></div>`).join('')}</div>${S.pitch.opening ? `<details style="margin-top:10px"><summary class="small muted">Peek at your written opening</summary><p class="small" style="margin-top:6px">${esc(S.pitch.opening)}</p></details>` : ''}<div class="row" style="margin-top:14px;justify-content:space-between"><button class="btn" data-close>Close</button><button class="btn pri" id="og">Start</button></div>`, (m) => {
    $('#ob', m).onclick = e => { const r = e.target.closest('[data-b]'); if (r) r.classList.toggle('done'); };
    $('#og', m).onclick = () => { clearInterval(t); left = 30; t = setInterval(() => { left--; $('#ol', m).textContent = '0:' + String(left).padStart(2, '0'); if (left <= 0) { clearInterval(t); const n = $$('.todo.done', m).length; toast(n === 4 ? 'All 4 beats. That is an Exemplary opening.' : `${n}/4 beats. Tighten it and go again.`, 3500); if (n === 4) confetti(); } }, 1000); };
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) clearInterval(t); }, true);
  });
}

/* ===================== XP + ACHIEVEMENTS ===================== */
function xp() {
  const mast = Object.values(S.m).filter(m => m.s >= 2).length, les = Object.keys(S.lessons).length, cards = Object.keys(S.cards).length;
  const v = les * 50 + mast * 20 + S.exams.length * 40 + S.runs.length * 50 + S.scores.length * 30 + cards * 4 + (S.deckRuns || []).length * 40 + Object.values(S.daily || {}).filter(d => d.ok).length * 25 + Object.keys(S.tasks).length * 10 + streak() * 15;
  const lvl = Math.floor(Math.sqrt(v / 60)) + 1, cur = 60 * (lvl - 1) ** 2, nxt = 60 * lvl ** 2;
  return { xp: v, lvl, pct: (v - cur) / (nxt - cur) * 100, nxt: nxt - v };
}
const BADGES = [
  ['🎬', 'First story', 'Finish a lesson', () => Object.keys(S.lessons).length >= 1],
  ['📚', 'Scholar', 'Finish every lesson', () => LESSONS.every(l => S.lessons[l.id])],
  ['🧠', 'Ten down', 'Master 10 concepts', () => Object.values(S.m).filter(m => m.s >= 2).length >= 10],
  ['🏛️', 'Half the map', 'Master 50 concepts', () => Object.values(S.m).filter(m => m.s >= 2).length >= 50],
  ['💯', 'Full map', 'Master all 100 concepts', () => Object.values(S.m).filter(m => m.s >= 2).length >= 100],
  ['📝', 'Test drive', 'Finish a mock exam', () => S.exams.length >= 1],
  ['🎯', 'Exam ready', 'Score 80%+ on a 50+ question mock', () => S.exams.some(e => e.n >= 50 && e.ok / e.n >= .8)],
  ['⏱️', 'First run', 'Do a full timed run', () => S.runs.length >= 1],
  ['🔁', 'Reps', '5 timed runs', () => S.runs.length >= 5],
  ['🏆', 'Exemplary', 'AI judge score of 85+', () => S.scores.some(s => s.src === 'ai' && s.total >= 85)],
  ['🖼️', 'Deck check', 'Analyze your slides', () => (S.deckRuns || []).length >= 1],
  ['🔥', 'On fire', '7 day study streak', () => streak() >= 7],
  ['🃏', 'Card shark', 'See all flashcards', () => Object.keys(S.cards).length >= CARDS.length],
  ['⚡', 'Quick draw', '15+ in a speed round', () => (S.speedBest || 0) >= 15],
  ['🗂️', 'Planner', 'Finish 20 plan tasks', () => Object.keys(S.tasks).filter(k => k[0] === 'w').length >= 20],
  ['📌', 'PI pro', 'Check off every PI', () => PIS.every(p => (S.pi || {})[p[0]])]
];
VIEWS.trophies = el => {
  const x = xp(); const got = BADGES.filter(b => b[3]()).length;
  el.innerHTML = `<div class="top"><div><div class="sub">${got}/${BADGES.length} badges</div><h1>Trophies</h1></div></div>
  <div class="card hero"><div class="row" style="gap:18px">${ringSVG(x.pct, 118, 'level ' + x.lvl)}<div><div class="big mono">${x.xp} XP</div><div class="small muted" style="margin-top:6px">${x.nxt} XP to level ${x.lvl + 1}</div><div class="tiny muted" style="margin-top:6px">XP comes from lessons, mastered concepts, mocks, runs, scores, cards, tasks and streaks.</div></div></div></div>
  <div class="badges" style="margin-top:14px">${BADGES.map(b => { const ok = b[3](); return `<div class="card" style="text-align:center;${ok ? 'border-color:rgba(243,196,84,.4)' : 'opacity:.55'}"><div style="font-size:38px;${ok ? '' : 'filter:grayscale(1)'}">${b[0]}</div><b class="small">${b[1]}</b><div class="tiny muted">${b[2]}</div></div>`; }).join('')}</div>`;
};

/* ===================== PITCH extras: script analyzer, versions, persona, leave-behind, video ===================== */
const JARGON = /\b(ebitda|amortization|basis|fiduciary|esop|liquidity|actuarial|1042|qsbs|grat|idgt)\b/gi;
function scriptAnalyze() {
  const P = S.pitch, all = SECTIONS.map(s => P[s.k]).join(' ');
  if (wc(all) < 30) return toast('Write at least a few sentences first');
  const sents = all.split(/[.!?]+/).filter(x => x.trim()), avgS = wc(all) / Math.max(1, sents.length);
  const qs = (all.match(/\?/g) || []).length, needQs = (P.needs.match(/\?/g) || []).length;
  const you = (all.match(/\byou(r|rs)?\b/gi) || []).length, me = (all.match(/\b(i|we|me|my|our)\b/gi) || []).length;
  const ben = (all.match(/which means|so you|this lets you|you get|you keep|you can|this gives you|that way you/gi) || []).length;
  const nums = (all.match(/\$?\d[\d,.]*%?/g) || []).length, jar = [...new Set((all.match(JARGON) || []).map(x => x.toLowerCase()))];
  const fill = (all.match(/\b(um|uh|like|basically|literally|kind of|sort of)\b/gi) || []).length;
  const close = /next step|meet|schedule|start|sign|monday|tuesday|wednesday|thursday|friday|this week/i.test(P.close);
  const trial = /does (this|that) (sound|feel|make sense|fit)|how does that sound|any concerns/i.test(all);
  const laer = /understand|fair (concern|question)|great question|i hear you|that makes sense/i.test(P.solution);
  const checks = [
    [needQs >= 4, `${needQs} questions in needs assessment`, 'Aim for 4-6 open questions'],
    [you >= me, `You-focus: ${you} "you" vs ${me} "I/we"`, 'Talk about them more than yourself'],
    [ben >= 3, `${ben} benefit phrases ("which means", "so you")`, 'Turn features into benefits for this client'],
    [nums >= 4, `${nums} specific numbers`, 'Use real figures: value, income gap, timeline'],
    [avgS <= 22, `Avg sentence ${avgS.toFixed(0)} words`, 'Shorter sentences are easier to say and hear'],
    [trial, 'Trial close found', 'Add "Does this direction feel right?" before closing'],
    [laer, 'Objection handling language found', 'Acknowledge before answering: "That is a fair concern..."'],
    [close, 'Specific next step in the close', 'End with a dated next step'],
    [fill === 0, `${fill} filler words`, 'Cut um / like / basically'],
    [!jar.length || jar.length <= 3, `${jar.length} jargon terms${jar.length ? ': ' + jar.join(', ') : ''}`, 'Define jargon in plain words the first time']
  ];
  const sc = Math.round(checks.filter(c => c[0]).length / checks.length * 100);
  modal(`<div class="row sp"><h3>🔎 Script analysis</h3><span class="pill ${sc >= 80 ? 'ac' : sc >= 50 ? 'gold' : 'red'} mono">${sc}/100</span></div><p class="tiny muted" style="margin:4px 0 12px">On-device checks for what the rubric rewards. No AI needed.</p>${checks.map(c => `<div class="row small" style="padding:8px 0;border-bottom:1px solid var(--line);align-items:flex-start;gap:10px"><span>${c[0] ? '✅' : '⚠️'}</span><div><b>${esc(c[1])}</b>${c[0] ? '' : `<div class="muted">${esc(c[2])}</div>`}</div></div>`).join('')}<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn pri" data-close>Got it</button></div>`);
}
function saveVersion() { (S.versions = S.versions || []).push({ ts: Date.now(), p: JSON.parse(JSON.stringify(S.pitch)), words: SECTIONS.reduce((a, s) => a + wc(S.pitch[s.k]), 0) }); if (S.versions.length > 30) S.versions.shift(); save(); toast('Version saved'); }
function versionsModal() {
  const V = (S.versions || []).slice().reverse();
  modal(`<h3>Script versions</h3>${V.length ? V.map((v, i) => `<div class="row sp" style="padding:10px 0;border-bottom:1px solid var(--line)"><div><b class="small">${new Date(v.ts).toLocaleString()}</b><div class="tiny muted">${v.words} words</div></div><button class="btn sm" data-v="${V.length - 1 - i}">Restore</button></div>`).join('') : '<div class="empty small">No versions yet. Tap "Save version" before big edits.</div>'}<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Close</button></div>`, (m, close) => {
    m.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; saveVersion(); S.pitch = Object.assign({}, S.versions[+b.dataset.v].p); save(); close(); toast('Restored (current version saved first)'); render(); });
  });
}
function randomPersona() {
  const biz = [['HVAC company', 22, 3.2, 480], ['family restaurant group (3 locations)', 65, 4.1, 520], ['auto repair shop', 9, 1.4, 310], ['landscaping company', 30, 2.6, 400], ['dental lab', 14, 2.0, 450], ['print and sign shop', 11, 1.6, 290], ['plumbing contractor', 18, 2.8, 430], ['boutique bakery', 12, 1.1, 220]];
  const names = ['Pat Morgan', 'Linda Alvarez', 'Robert Chen', 'Denise Walker', 'Mike Patel', 'Karen O\'Neil', 'Tom Nguyen', 'Sharon Brooks'];
  const fam = ['one daughter in a different career', 'a son who works in the business but is not ready to lead', 'two kids who are not interested', 'a spouse who does the books', 'a nephew who wants to buy in'];
  const worry = ['taking care of long-time employees', 'having enough income for 30 years', 'paying too much tax on the sale', 'what happens if a buyer stops paying', 'keeping the family name on the door', 'health insurance before Medicare'];
  const b = pick(biz), age = 56 + (Math.random() * 4 | 0);
  S.pitch.persona = `${pick(names)}, ${age}, owns a ${b[0]}: ${b[1]} employees, about $${b[2]}M revenue and $${b[3]}k SDE. Has ${pick(fam)}. Wants to retire around ${age + 3 + (Math.random() * 4 | 0)}. Biggest worry: ${pick(worry)}.`;
  save(); render(); toast('New client persona');
}
function leaveBehind() {
  const P = S.pitch; const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to open the one-pager');
  const sec = (t, s) => s && s.trim() ? `<h2>${t}</h2><p>${esc(s).replace(/\n/g, '<br>')}</p>` : '';
  w.document.write(`<!doctype html><title>Leave-behind</title><style>body{font:14px/1.5 Inter,system-ui,sans-serif;color:#13202f;max-width:720px;margin:32px auto;padding:0 24px}h1{font-size:24px;margin:0;border-bottom:4px solid #d4a84b;padding-bottom:8px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#1f6f50;margin:20px 0 4px}.m{color:#5b6677;font-size:12px}@media print{button{display:none}}</style><button onclick="print()" style="float:right;padding:8px 14px">Print / Save PDF</button><h1>Your Retirement + Succession Plan</h1><div class="m">${esc(P.firm || 'Your firm')} · Prepared ${new Date().toLocaleDateString()}</div>${sec('Where you are today', P.persona)}${sec('What you told us matters', P.needs)}${sec('Your options', P.value)}${sec('Our recommendation', P.solution)}${sec('Next steps', P.close)}<p class="m" style="margin-top:28px">Educational illustration for DECA competition. Not tax or legal advice.</p>`);
  w.document.close();
}
async function videoPractice() {
  let st, rec, chunks = [];
  modal(`<h3>🎥 Video practice</h3><p class="tiny muted">Mirror view. Recording stays on your device.</p><video id="vv" autoplay muted playsinline style="width:100%;border-radius:12px;background:#000;transform:scaleX(-1);margin-top:10px"></video><div class="row wrap small" style="gap:6px;margin-top:10px">${['Eye contact', 'Shoulders back', 'Hands visible', 'Smile', 'Pause after numbers', 'No swaying'].map(x => `<span class="pill">${x}</span>`).join('')}</div><div id="vp"></div><div class="row" style="margin-top:12px;justify-content:space-between"><button class="btn" data-close>Close</button><button class="btn pri" id="vr">● Record</button></div>`, async (m) => {
    try { st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }); $('#vv', m).srcObject = st; } catch (e) { toast('Camera blocked. Allow camera access.'); }
    $('#vr', m).onclick = () => {
      if (!st) return; if (rec && rec.state === 'recording') { rec.stop(); return; }
      chunks = []; rec = new MediaRecorder(st); rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => { const url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })); $('#vp', m).innerHTML = `<video controls src="${url}" playsinline style="width:100%;border-radius:12px;margin-top:10px"></video><a class="btn sm" href="${url}" download="fce-practice.webm" style="margin-top:8px">Download</a>`; $('#vr', m).textContent = '● Record'; S.runs.push({ ts: Date.now(), sec: 0, video: true }); save(); };
      rec.start(); $('#vr', m).textContent = '■ Stop';
    };
    const stop = () => { try { rec && rec.state === 'recording' && rec.stop(); } catch (e) { } st && st.getTracks().forEach(t => t.stop()); };
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) stop(); }, true);
  });
}
async function aiPersona() {
  try { toast('Generating a client...'); const t = await aiCall({ messages: [{ role: 'user', content: `Invent a realistic client for the DECA FCE 2026-27 case (small-business owner, late 50s, thinking about retirement and succession). One paragraph, under 70 words: name, age, business type, employees, revenue, SDE, family situation, retirement target age, top 2 worries, one surprising detail a judge might reveal. No em dashes.` }], system: 'Concise, realistic.', max_tokens: 300 }); S.pitch.persona = t; save(); render(); }
  catch (e) { toast(e.message, 4000); }
}

/* ===================== Command palette (Ctrl/Cmd + K) ===================== */
function palette() {
  const items = [].concat(
    NAV.map(n => ['Go', n[1], () => location.hash = n[0]]),
    LESSONS.map(l => ['Lesson', l.t, () => playLesson(l.id)]),
    Object.keys(LABS).map(k => ['Lab', LABS[k].t, () => openLab(k)]),
    [['Practice', 'Smart practice (10)', () => runQuiz(weightedPick(10), { title: 'Smart practice', onDone: () => render() })], ['Game', 'Speed round', speedRound], ['Game', 'Match', matchGame], ['Drill', 'Opener sprint', openerSprint], ['Pitch', 'Teleprompter', teleprompter], ['Pitch', 'Analyze script', scriptAnalyze], ['Pitch', 'Video practice', videoPractice], ['Pitch', 'Leave-behind one-pager', leaveBehind], ['Tool', 'Exit calculator', () => location.hash = 'tools/exit'], ['Tool', 'Retirement gap', () => location.hash = 'tools/gap'], ['Deck', 'Analyze my slides', () => location.hash = 'deck'], ['Deck', 'Templates', () => location.hash = 'deck/templates']],
    CARDS.map(c => ['Term', c[0], () => modal(`<h3>${esc(c[0])}</h3><p style="margin-top:8px">${esc(c[1])}</p><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-close>Close</button></div>`)])
  );
  modal(`<input type="text" id="pq" placeholder="Search lessons, tools, terms..." autocomplete="off"><div id="pl" style="margin-top:10px;max-height:56vh;overflow:auto"></div>`, (m, close) => {
    let sel = 0, list = [];
    const draw = () => { const q = $('#pq', m).value.toLowerCase(); list = items.filter(i => (i[0] + ' ' + i[1]).toLowerCase().includes(q)).slice(0, 40); sel = Math.min(sel, list.length - 1); $('#pl', m).innerHTML = list.map((i, k) => `<button class="opt" data-k="${k}" style="padding:10px 12px;${k === sel ? 'border-color:var(--ac)' : ''}"><span class="pill" style="min-width:70px;justify-content:center">${i[0]}</span><span class="small">${esc(i[1])}</span></button>`).join(''); };
    const go = k => { const it = list[k]; if (!it) return; close(); it[2](); };
    $('#pq', m).oninput = () => { sel = 0; draw(); };
    $('#pq', m).onkeydown = e => { if (e.key === 'ArrowDown') { sel = Math.min(list.length - 1, sel + 1); draw(); e.preventDefault(); } if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); } if (e.key === 'Enter') go(sel); };
    $('#pl', m).onclick = e => { const b = e.target.closest('[data-k]'); if (b) go(+b.dataset.k); };
    draw(); setTimeout(() => $('#pq', m).focus(), 30);
  });
}
addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); } });
