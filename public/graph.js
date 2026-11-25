/* Graph engine for the City Water Network (shared by browser + Node). Fixed vertex set, editable edges. */
(function (root) {
  const V = ['W', 'A', 'B', 'C', 'D', 'E'];
  const norm = (a, b) => (V.indexOf(a) < V.indexOf(b) ? a + b : b + a);
  const ALL = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) ALL.push(V[i] + V[j]);
  const ORIGINAL = ['WA', 'WB', 'WC', 'WD', 'WE', 'AB', 'BC', 'CD', 'DE', 'EA'].map(e => norm(e[0], e[1]));

  function clean(list) {            // normalise + validate + dedupe; null if invalid
    if (!Array.isArray(list)) return null;
    const out = new Set();
    for (const e of list) {
      if (typeof e !== 'string' || e.length !== 2 || e[0] === e[1] || !V.includes(e[0]) || !V.includes(e[1])) return null;
      out.add(norm(e[0], e[1]));
    }
    return ALL.filter(e => out.has(e));
  }

  // Chromatic polynomial by deletion-contraction: P(G) = P(G-e) - P(G/e). Polynomials are coefficient arrays.
  function poly(n, es) {
    if (!es.length) { const p = Array(n + 1).fill(0); p[n] = 1; return p; }
    let [u, v] = es[0]; if (u > v) [u, v] = [v, u];
    const rest = es.slice(1), seen = new Set(), con = [];
    for (const [a, b] of rest) {
      let x = a === v ? u : a, y = b === v ? u : b;
      if (x === y) continue;
      x = x > v ? x - 1 : x; y = y > v ? y - 1 : y;
      const k = Math.min(x, y) + ',' + Math.max(x, y);
      if (!seen.has(k)) { seen.add(k); con.push([x, y]); }
    }
    const A = poly(n, rest), B = poly(n - 1, con);
    return A.map((c, i) => c - (B[i] || 0));
  }
  const evalP = (p, k) => p.reduceRight((s, c) => s * k + c, 0);
  const fmt = p => {
    const t = p.map((c, i) => [c, i]).filter(([c]) => c).reverse()
      .map(([c, i]) => (c < 0 ? '- ' : '+ ') + (Math.abs(c) === 1 && i ? '' : Math.abs(c)) + (i ? 'k' + (i > 1 ? '^' + i : '') : ''));
    return t.length ? t.join(' ').replace(/^\+ /, '') : '0';
  };

  // Planarity for 6 vertices: non-planar iff a K5 or K3,3 minor exists (K3,3 as subgraph; K5 after deleting a vertex or contracting one edge).
  function planar(es) {
    const key = (a, b) => (a < b ? a + ',' + b : b + ',' + a), S = new Set(es.map(([a, b]) => key(a, b)));
    const k5 = (T, vs) => vs.every((a, i) => vs.slice(i + 1).every(b => T.has(key(a, b))));
    for (let x = 0; x < 6; x++) if (k5(S, [0, 1, 2, 3, 4, 5].filter(v => v !== x))) return false;
    for (let m = 0; m < 64; m++) {
      const s = [], t = []; for (let v = 0; v < 6; v++) (m >> v & 1 ? s : t).push(v);
      if (s.length === 3 && s.every(a => t.every(b => S.has(key(a, b))))) return false;
    }
    for (const [u, v] of es) {
      const T = new Set();
      for (const [a, b] of es) { const x = a === v ? u : a, y = b === v ? u : b; if (x !== y) T.add(key(x, y)); }
      if (k5(T, [0, 1, 2, 3, 4, 5].filter(w => w !== v))) return false;
    }
    return true;
  }

  function colour(adj, k) {         // backtracking proper k-colouring (the report's colorGraph, one witness)
    const c = Array(6).fill(-1);
    const go = i => {
      if (i === 6) return true;
      for (let x = 0; x < k; x++) if (adj[i].every(n => c[n] !== x)) { c[i] = x; if (go(i + 1)) return true; c[i] = -1; }
      return false;
    };
    return go(0) ? c : null;
  }

  function analyze(edges) {
    const es = edges.map(e => [V.indexOf(e[0]), V.indexOf(e[1])]);
    const adj = V.map(() => []); es.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    const deg = adj.map(a => a.length), seen = new Set(); let comps = 0;
    for (let s = 0; s < 6; s++) if (!seen.has(s)) {
      comps++; const q = [s]; seen.add(s);
      while (q.length) for (const n of adj[q.pop()]) if (!seen.has(n)) { seen.add(n); q.push(n); }
    }
    const p = poly(6, es), pv = [0, 1, 2, 3, 4, 5, 6, 7].map(k => evalP(p, k));
    let chi = 1; while (pv[chi] <= 0) chi++;
    const isPlanar = planar(es);
    return {
      E: es.length, deg, sumDeg: deg.reduce((a, b) => a + b, 0), comps, connected: comps === 1,
      planar: isPlanar, faces: isPlanar ? 1 + comps - 6 + es.length : null, poly: p, polyStr: fmt(p), pv, chi,
      coloring: colour(adj, chi)
    };
  }

  function impact(edges) {          // effect of deleting each single pipeline
    return edges.map(e => {
      const r = analyze(edges.filter(x => x !== e));
      return { edge: e, connected: r.connected, planar: r.planar, chi: r.chi, p3: r.pv[3] };
    });
  }

  const api = { V, ALL, ORIGINAL, norm, clean, analyze, impact };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WaterGraph = api;
})(typeof window !== 'undefined' ? window : globalThis);
