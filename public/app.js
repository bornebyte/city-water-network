const $ = s => document.querySelector(s), G = window.WaterGraph;
const POS = { W: [300, 220] };
['A', 'B', 'C', 'D', 'E'].forEach((v, i) => { const a = (-90 + 72 * i) * Math.PI / 180; POS[v] = [300 + 175 * Math.cos(a), 215 + 175 * Math.sin(a)]; });
const NAME = { W: 'Water plant', A: 'Residential', B: 'Hospital', C: 'School', D: 'Industrial', E: 'Shopping' };
const TEAM = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0d9488'];
const PRESET = {
  orig: () => [...G.ORIGINAL], mod: () => G.ORIGINAL.filter(e => e !== 'WE'), none: () => [],
  k33: () => G.clean(['WA', 'WC', 'WE', 'BA', 'BC', 'BE', 'DA', 'DC', 'DE']),
  rand: () => G.ALL.filter(() => Math.random() < 0.5),
};
let edges = PRESET.orig(), sel = null, R;
const lab = e => e[0] + '–' + e[1];
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2300); };
const api = (u, m, b) => fetch(u, { method: m || 'GET', headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
const offline = () => toast('Server not reachable. Run npm start to use the database features.');

function render() {
  R = G.analyze(edges);
  const lines = edges.map(e => {
    const [a, b] = [POS[e[0]], POS[e[1]]];
    return `<line class="edge" data-e="${e}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"><title>Pipeline ${lab(e)}: tap to remove</title></line>`;
  }).join('');
  const nodes = G.V.map((v, i) => `<g class="node${sel === v ? ' sel' : ''}" data-v="${v}" tabindex="0" role="button" aria-label="${NAME[v]}">
    <circle cx="${POS[v][0]}" cy="${POS[v][1]}" r="27" fill="${R.coloring ? TEAM[R.coloring[i]] : '#888'}"/>
    <text class="v" x="${POS[v][0]}" y="${POS[v][1] + 7}">${v}</text><text class="s" x="${POS[v][0]}" y="${POS[v][1] + 46}">${NAME[v]}</text></g>`).join('');
  $('#svg').innerHTML = lines + nodes;
  $('#sel').textContent = sel ? `${NAME[sel]} selected. Tap another location to connect or disconnect.` : 'Node colour = maintenance team in an optimal colouring.';
  const c = (t, v, s, cls = '') => `<div class="card ${cls}"><span>${t}</span><b>${v}</b><span>${s}</span></div>`;
  $('#cards').innerHTML = c('Locations / pipelines', `6 / ${R.E}`, 'V and E') +
    c('Connected', R.connected ? 'Yes' : 'No', R.comps + ' component' + (R.comps > 1 ? 's' : ''), R.connected ? 'ok' : 'bad') +
    c('Planar', R.planar ? 'Yes' : 'No', R.planar ? R.faces + ' faces' : 'K5 or K3,3 minor', R.planar ? 'ok' : 'bad') +
    c('Chromatic number', R.chi, R.chi + ' maintenance teams') + c('P(G, 3)', R.pv[3], 'valid 3-colourings') + c('P(G, 4)', R.pv[4], 'valid 4-colourings');
  $('#degs').innerHTML = G.V.map((v, i) => `<div class="dg"><b>${v}</b><i style="width:${R.deg[i] * 20}%"></i><span>${R.deg[i]}</span></div>`).join('');
  $('#hand').textContent = `Sum of degrees = ${R.sumDeg}  |  2|E| = ${2 * R.E}  ${R.sumDeg === 2 * R.E ? '✓ Handshaking theorem holds' : '✗'}`;
  $('#euler').textContent = R.planar ? `V − E + F = 2 → 6 − ${R.E} + F = 1 + ${R.comps} → F = ${R.faces}` : 'No planar embedding exists, so Euler\'s formula does not apply to a flat drawing.';
  $('#planNote').textContent = R.planar ? (R.E <= 12 ? 'Necessary bound E ≤ 3V − 6 = 12 is satisfied and a minor test finds no K5 or K3,3.' : '') : 'Kuratowski/Wagner: a graph is planar exactly when it has no K5 or K3,3 minor. This one does.';
  $('#poly').textContent = 'P(G, k) = ' + R.polyStr;
  drawK(); drawImpact();
}
function drawK() {
  const k = +$('#k').value; $('#kv').textContent = k;
  $('#kres').textContent = R.pv[k] ? `${R.pv[k].toLocaleString()} valid team assignments with ${k} team${k > 1 ? 's' : ''}` : `No valid assignment with ${k} team${k > 1 ? 's' : ''}`;
  const mx = Math.log10(Math.max(...R.pv.slice(1)) + 1) || 1;
  $('#chart').innerHTML = R.pv.slice(1).map((v, i) => `<div class="${i + 1 === k ? 'cur' : ''}" style="height:${Math.max(3, Math.log10(v + 1) / mx * 100)}%"><span>${v}</span><small>${i + 1}</small></div>`).join('');
}
function drawImpact() {
  const rows = G.impact(edges);
  $('#itab').innerHTML = rows.length ? '<tr><th>Cut pipeline</th><th>Connected</th><th>Planar</th><th>χ</th><th>P(G,3)</th><th>Effect</th></tr>' +
    rows.map(r => {
      const d = r.chi - R.chi, t = !r.connected ? '<span class="tag r">Disconnects network</span>' : d < 0 ? '<span class="tag g">Saves a team</span>' : '<span class="tag">No change</span>';
      return `<tr class="click" data-e="${r.edge}"><td><b>${lab(r.edge)}</b></td><td>${r.connected ? 'Yes' : 'No'}</td><td>${r.planar ? 'Yes' : 'No'}</td><td>${r.chi}</td><td>${r.p3}</td><td>${t}</td></tr>`;
    }).join('')
    : '<tr><td>No pipelines in the current network. Add some in the lab.</td></tr>';
}
function setEdges(e) { edges = G.clean(e); sel = null; render(); }
function toggle(a, b) { const e = G.norm(a, b); setEdges(edges.includes(e) ? edges.filter(x => x !== e) : [...edges, e]); }

$('#svg').addEventListener('click', ev => {
  const n = ev.target.closest('.node'), e = ev.target.closest('.edge');
  if (e) return setEdges(edges.filter(x => x !== e.dataset.e));
  if (!n) return;
  const v = n.dataset.v; if (!sel) { sel = v; render(); } else if (sel === v) { sel = null; render(); } else toggle(sel, v);
});
$('#svg').addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { const n = ev.target.closest('.node'); if (n) { ev.preventDefault(); n.dispatchEvent(new MouseEvent('click', { bubbles: true })); } } });
$('#presets').onclick = ev => { const p = ev.target.dataset.p; if (p) { setEdges(PRESET[p]()); toast('Layout updated'); } };
$('#k').oninput = drawK;
$('#itab').onclick = ev => { const r = ev.target.closest('tr[data-e]'); if (r) { setEdges(edges.filter(x => x !== r.dataset.e)); toast(`Pipeline ${lab(r.dataset.e)} removed`); } };
$('#export').onclick = () => navigator.clipboard.writeText(JSON.stringify({ edges, chi: R.chi, polynomial: R.polyStr }, null, 2)).then(() => toast('Copied analysis as JSON'), () => toast('Clipboard blocked by browser'));
$('#save').onclick = () => api('/api/scenarios', 'POST', { name: $('#sname').value, edges }).then(r => { if (r.error) return toast(r.error); toast('Scenario saved'); $('#sname').value = ''; loadScen(); }).catch(offline);

function loadScen() {
  api('/api/scenarios').then(list => {
    $('#slist').innerHTML = list.length ? list.map(s => `<div class="card"><span>${s.created}</span><b>${s.name.replace(/</g, '&lt;')}</b><span>${s.edges.length} pipelines · χ = ${s.chi}</span>
      <div class="row"><button data-load="${s.id}">Open in lab</button><button class="ghost" data-del="${s.id}">Delete</button></div></div>`).join('') : '<p class="hint">Nothing saved yet. Build a layout in the lab and save it.</p>';
    $('#slist').onclick = ev => {
      const l = ev.target.dataset.load, d = ev.target.dataset.del;
      if (l) { setEdges(list.find(s => s.id == l).edges); show('lab'); toast('Scenario loaded'); }
      if (d) api('/api/scenarios/' + d, 'DELETE').then(() => { toast('Scenario deleted'); loadScen(); });
    };
  }).catch(() => { $('#slist').innerHTML = '<p class="hint">Start the Node server to see saved scenarios.</p>'; });
}
let quiz = [];
function loadQuiz() {
  api('/api/quiz').then(q => {
    quiz = q;
    $('#qs').innerHTML = q.map((x, i) => `<div class="q" id="q${i}"><p>${i + 1}. ${x.q}</p>${x.o.map((o, j) => `<label><input type="radio" name="q${i}" value="${j}"> ${o}</label>`).join('')}</div>`).join('');
  }).catch(() => { $('#qs').innerHTML = '<p class="hint">Start the Node server to take the quiz.</p>'; });
  loadBoard();
}
function loadBoard() { api('/api/scores').then(s => { $('#board').innerHTML = s.length ? s.map(x => `<li>${x.name.replace(/</g, '&lt;')}: ${x.score}/${x.total}</li>`).join('') : '<li>No scores yet. Be the first.</li>'; }).catch(() => { }); }
$('#qsub').onclick = () => {
  const answers = quiz.map((_, i) => { const c = document.querySelector(`input[name=q${i}]:checked`); return c ? +c.value : -1; });
  if (answers.includes(-1)) return toast('Answer every question first');
  api('/api/quiz', 'POST', { name: $('#qname').value, answers }).then(r => {
    r.correct.forEach((a, i) => $('#q' + i).className = 'q ' + (answers[i] === a ? 'right' : 'wrong'));
    $('#qres').textContent = `You scored ${r.score} of ${r.total}.`; loadBoard();
  }).catch(offline);
};
function show(t) {
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === t)); document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  if (t === 'scen') loadScen(); if (t === 'quiz') loadQuiz(); scrollTo(0, 0);
}
$('#tabs').onclick = ev => { if (ev.target.dataset.tab) show(ev.target.dataset.tab); };
$('#theme').onclick = () => { const d = document.documentElement, dark = getComputedStyle(d).getPropertyValue('--bg').trim() === '#0b1e29'; d.dataset.theme = dark ? 'light' : 'dark'; };
render();
