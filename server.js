// City Water Network backend: plain Node http + sqlite3. Run: npm install && npm start
const http = require('http'), fs = require('fs'), path = require('path'), sqlite3 = require('sqlite3');
const G = require('./public/graph.js');
const PORT = process.env.PORT || 3000, PUB = path.join(__dirname, 'public');
const db = new sqlite3.Database(path.join(__dirname, 'water.db'));
const run = (q, p = []) => new Promise((ok, no) => db.run(q, p, function (e) { e ? no(e) : ok(this); }));
const all = (q, p = []) => new Promise((ok, no) => db.all(q, p, (e, r) => (e ? no(e) : ok(r))));

const QUIZ = [
  { q: 'Sum of all vertex degrees in the original network?', o: ['10', '15', '20', '25'], a: 2 },
  { q: 'Faces in the planar drawing (Euler: V - E + F = 2)?', o: ['4', '5', '6', '7'], a: 2 },
  { q: 'Chromatic number of the original network?', o: ['2', '3', '4', '5'], a: 2 },
  { q: 'P(G, 3) for the original network?', o: ['0', '3', '6', '120'], a: 0 },
  { q: 'Which classic graph is the original network?', o: ['Wheel with 5 rim vertices', 'Complete graph K6', 'Petersen graph', 'K3,3'], a: 0 },
  { q: 'After removing pipeline WE, how many valid 3-colourings exist?', o: ['0', '6', '12', '120'], a: 1 },
];

(async () => {
  await run('CREATE TABLE IF NOT EXISTS scenarios(id INTEGER PRIMARY KEY, name TEXT, edges TEXT, chi INTEGER, created TEXT DEFAULT CURRENT_TIMESTAMP)');
  await run('CREATE TABLE IF NOT EXISTS scores(id INTEGER PRIMARY KEY, name TEXT, score INTEGER, total INTEGER, created TEXT DEFAULT CURRENT_TIMESTAMP)');
  if (!(await all('SELECT 1 FROM scenarios'))[0]) {
    const seed = [['Original network', G.ORIGINAL], ['Pipeline WE removed', G.ORIGINAL.filter(e => e !== 'WE')]];
    for (const [n, e] of seed) await run('INSERT INTO scenarios(name,edges,chi) VALUES(?,?,?)', [n, JSON.stringify(e), G.analyze(e).chi]);
  }
})().catch(e => { console.error(e); process.exit(1); });

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };
const send = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const body = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); });

async function api(req, res, url) {
  const m = req.method, id = url.split('/')[3];
  if (url === '/api/health') return send(res, 200, { ok: true, vertices: G.V, possibleEdges: G.ALL.length });
  if (url === '/api/analyze' && m === 'POST') {
    const edges = G.clean((await body(req)).edges); if (!edges) return send(res, 400, { error: 'Invalid edge list' });
    return send(res, 200, { edges, ...G.analyze(edges), impact: G.impact(edges) });
  }
  if (url.startsWith('/api/scenarios')) {
    if (m === 'GET') return send(res, 200, (await all('SELECT * FROM scenarios ORDER BY id DESC')).map(r => ({ ...r, edges: JSON.parse(r.edges) })));
    if (m === 'POST') { const b = await body(req), edges = G.clean(b.edges), name = String(b.name || '').trim().slice(0, 60);
      if (!edges || !name) return send(res, 400, { error: 'Name and a valid edge list are required' });
      const r = await run('INSERT INTO scenarios(name,edges,chi) VALUES(?,?,?)', [name, JSON.stringify(edges), G.analyze(edges).chi]);
      return send(res, 201, { id: r.lastID }); }
    if (m === 'DELETE' && id) { await run('DELETE FROM scenarios WHERE id=?', [+id]); return send(res, 200, { ok: true }); }
  }
  if (url === '/api/quiz' && m === 'GET') return send(res, 200, QUIZ.map(({ q, o }) => ({ q, o })));
  if (url === '/api/quiz' && m === 'POST') {
    const b = await body(req), ans = Array.isArray(b.answers) ? b.answers : [], name = String(b.name || 'Anonymous').trim().slice(0, 30) || 'Anonymous';
    const score = QUIZ.reduce((s, x, i) => s + (ans[i] === x.a ? 1 : 0), 0);
    await run('INSERT INTO scores(name,score,total) VALUES(?,?,?)', [name, score, QUIZ.length]);
    return send(res, 200, { score, total: QUIZ.length, correct: QUIZ.map(x => x.a) });
  }
  if (url === '/api/scores') return send(res, 200, await all('SELECT name,score,total,created FROM scores ORDER BY score DESC, id ASC LIMIT 10'));
  send(res, 404, { error: 'Not found' });
}

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url.startsWith('/api/')) return await api(req, res, url);
    const file = path.normalize(path.join(PUB, url === '/' ? 'index.html' : url));
    if (!file.startsWith(PUB)) return send(res, 403, { error: 'Forbidden' });
    fs.readFile(file, (e, d) => { if (e) return send(res, 404, { error: 'Not found' });
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(d); });
  } catch (e) { send(res, 400, { error: e.message }); }
}).listen(PORT, () => console.log('City Water Network running at http://localhost:' + PORT));
