// "Como um prédio fica de pé" — Isometric Infographic film.
import { Iso, tri, clamp, lerp, seg, ss, eo, eio, back, hash, TAU, C30, S30, pin, inset, cutLine, hatch, haloText, mix, hex, css, rgb } from './engine.js';
import { DUR as D, S, T, CAPS, b, BEAT } from './timeline.js';
export const DUR = D;

// ---------- palette ----------
const INK = '#2A2433', BG = '#F1EBDD', PAPER = '#FBF6EA';
const C = {
  top: tri('#D6C6A2', .18, .2), soil: tri('#A77850'), clay: tri('#CDA463'), rock: tri('#7E8794'),
  pit: tri('#9A7550'), mound: tri('#9A7550'),
  conc: tri('#B8BEC4'), col: tri('#A3ABB3'), slab: tri('#C9CDD0'), core: tri('#8F98A1'),
  glass: tri('#86BDB8', .25, .25), water: tri('#4F8FC7'), energy: tri('#E3A23B'), sewer: tri('#8C7C6E'),
  steel: tri('#E2B54E'), tank: tri('#6FA3CF'), coral: '#E8664A',
};
// ---------- world layout ----------
const B0 = -40, B1 = 9;                      // board extent (x and y)
const Z_SOIL = -3, Z_CLAY = -8, Z_ROCK = -14; // strata bottoms
const F0 = -10, F1 = 8;                       // building footprint
const EXC = 1.5;                              // excavation depth
const FH = 3, NF = 10;                        // floor height, floors
const COLS = [[-9.5, -9.5], [-1, -9.5], [7.5, -9.5], [-9.5, -1], [7.5, -1], [-9.5, 7.5], [-1, 7.5], [7.5, 7.5]];
const CORE = [-4.5, -4.5, 3.5, 3.5];          // x, y, w, d
const CUT = -5;                               // the cut quadrant: x > CUT and y > CUT
const PILE_TIP = -11.5;

// ---------- camera ----------
const KEYS = [
  [0.0, -10, -8, 1, 19], [3.4, -8, -6, 0, 22],
  [5.4, 3, 3, -6, 29], [8.4, 3, 3, -6, 29],
  [9.6, 0, 0, -5, 25], [15.0, 0, 0, -4.5, 23.5],
  [17.0, -1, -1, 10, 15], [24.6, -1, -1, 11, 14.2],
  [26.6, -2, -2, 13, 18.5], [31.0, -2, -2, 13, 19],
  [32.4, -1, -1, 12.5, 20.5], [37.8, -1, -1, 12.5, 21],
  [39.4, -1, -1, 13, 15.5], [43.3, -1, -1, 13, 15.5],
  [44.6, 4, 4, 22, 22], [49.6, 6, 6, -7.5, 22], [50.6, 6, 6, -7.5, 22],
  [53.6, -9, -9, 5, 10.2], [57.0, -9, -9, 5, 9.8],
];
function camAt(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const a = KEYS[i], c = KEYS[i + 1], u = eio(seg(t, a[0], c[0]));
  return { x: lerp(a[1], c[1], u), y: lerp(a[2], c[2], u), z: lerp(a[3], c[3], u), k: Math.exp(lerp(Math.log(a[4]), Math.log(c[4]), u)) };
}

// ---------- state helpers ----------
const floorT = i => i < NF ? T.floors[i] : T.roof;
const exc = t => EXC * eio(seg(t, T.dig0, T.dig1));
// cut quadrant offset (slides out along +x+y, then back)
function cutOff(t) {
  const out = eo(seg(t, T.cut + .3, T.cut + .65)), back_ = eio(seg(t, T.restore, T.restore + .6));
  return { d: 14 * out * (1 - back_), a: clamp(1 - seg(out * (1 - back_), .1, .75)), on: t > T.cut + .3 && t < T.restore + .6 };
}

// ---------- drawing ----------
function background(g, iso, t) {
  g.fillStyle = BG; g.fillRect(0, 0, 1920, 1080);
  // faint isometric dot lattice, anchored to the world plane z = Z_ROCK - 6
  const k = iso.cam.k, step = k < 14 ? 6 : 3;
  g.fillStyle = 'rgba(42,36,51,.10)';
  const [x0, y0] = iso.unP(0, 0, -20), [x1, y1] = iso.unP(1920, 1080, -20), [x2, y2] = iso.unP(1920, 0, -20), [x3, y3] = iso.unP(0, 1080, -20);
  const xs = [x0, x1, x2, x3], ys = [y0, y1, y2, y3];
  const ax = Math.floor(Math.min(...xs) / step) * step, bx = Math.max(...xs), ay = Math.floor(Math.min(...ys) / step) * step, by = Math.max(...ys);
  if ((bx - ax) * (by - ay) / (step * step) < 9000)
    for (let x = ax; x < bx; x += step) for (let y = ay; y < by; y += step) { const p = iso.P(x, y, -20); if (p[0] > -4 && p[0] < 1924 && p[1] > -4 && p[1] < 1084) g.fillRect(p[0] - 1, p[1] - 1, 2, 2); }
  // soft shadow under the board
  const c = iso.P((B0 + B1) / 2 + 3, (B0 + B1) / 2 + 3, Z_ROCK - 2), r = (B1 - B0) * k * .9;
  const gr = g.createRadialGradient(c[0], c[1], r * .2, c[0], c[1], r);
  gr.addColorStop(0, 'rgba(60,45,40,.18)'); gr.addColorStop(1, 'rgba(60,45,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
}

function board(iso, t) {
  const e = exc(t);
  iso.boxNow(B0, B0, Z_ROCK, B1 - B0, B1 - B0, Z_CLAY - Z_ROCK, C.rock);
  iso.boxNow(B0, B0, Z_CLAY, B1 - B0, B1 - B0, Z_SOIL - Z_CLAY, C.clay);
  // soil: around the pit, pit, then front lips
  const sh = -Z_SOIL;
  iso.boxNow(B0, B0, Z_SOIL, F0 - B0, B1 - B0, sh, C.soil, { faceColor: [C.top[0]] });
  iso.boxNow(F0, B0, Z_SOIL, B1 - F0, F0 - B0, sh, C.soil, { faceColor: [C.top[0]] });
  iso.boxNow(F0, F0, Z_SOIL, F1 - F0, F1 - F0, sh - e, C.soil, { faceColor: [e > .05 ? C.pit[0] : C.top[0]] });
  iso.boxNow(F1, F0, Z_SOIL, B1 - F1, B1 - F0, sh, C.soil, { faceColor: [C.top[0]] });
  iso.boxNow(F0, F1, Z_SOIL, F1 - F0, B1 - F1, sh, C.soil, { faceColor: [C.top[0]] });
  // seamless top and front faces (the split boxes leave hairlines)
  { const g0 = iso.g, P = (x, y, z) => iso.P(x, y, z);
    g0.beginPath(); [[B0, B0], [B1, B0], [B1, B1], [B0, B1]].forEach((q, i) => { const p = P(q[0], q[1], 0); i ? g0.lineTo(p[0], p[1]) : g0.moveTo(p[0], p[1]); }); g0.closePath();
    if (e > .05) { [[F0, F0], [F0, F1], [F1, F1], [F1, F0]].forEach((q, i) => { const p = P(q[0], q[1], 0); i ? g0.lineTo(p[0], p[1]) : g0.moveTo(p[0], p[1]); }); g0.closePath(); }
    g0.fillStyle = iso.col(C.top[0]); g0.fill('evenodd');
    iso.poly([P(B1, B0, 0), P(B1, B1, 0), P(B1, B1, Z_SOIL), P(B1, B0, Z_SOIL)], C.soil[2]);
    iso.poly([P(B0, B1, 0), P(B1, B1, 0), P(B1, B1, Z_SOIL), P(B0, B1, Z_SOIL)], C.soil[1]); }
  // strata pebbles on the front faces (deterministic)
  const g = iso.g;
  for (let i = 0; i < 70; i++) {
    const face = i % 2, u = B0 + 2 + hash(i * 3.1) * (B1 - B0 - 4), z = Z_ROCK + .6 + hash(i * 7.7) * (-Z_ROCK - 1.2);
    const p = face ? iso.P(B1, u, z) : iso.P(u, B1, z), r = (.12 + hash(i) * .16) * iso.cam.k;
    const lay = z > Z_SOIL ? C.soil : z > Z_CLAY ? C.clay : C.rock;
    g.beginPath(); g.ellipse(p[0], p[1], r, r * .6, 0, 0, TAU); g.fillStyle = iso.col(lay[2]); g.fill();
  }
  // spoil mound grows with the excavation, shrinks back when the site is cleaned
  const mh = 3.2 * eo(seg(t, T.dig0 + .3, T.dig1)) * (1 - ss(seg(t, T.slabPour0, T.slabPour1 + 1)));
  if (mh > .05) iso.coneNow(-22, 2, 0, 4.2 * Math.sqrt(mh / 3.2) + .4, mh, C.mound, { n: 12 });
}

// pile section rectangles on the two front faces (section convention)
const PILES = [   // [face, u, column index]   face 0: x = B1 plane (u = y), face 1: y = B1 plane (u = x)
  [0, -9.5], [0, -1], [0, 7.5], [1, -9.5], [1, -1],
];
const PILE_TOPS = COLS; // one pile per column (tops in the pit floor)
function pileProg(t, i) { return eio(seg(t, T.piles[i], T.piles[i] + BEAT * .85)); }
function pileSections(iso, t) {
  const g = iso.g, w = .6;
  PILES.forEach(([f, u], j) => {
    const idx = PILE_TOPS.findIndex(c => f === 0 ? c[1] === u && c[0] === 7.5 : c[0] === u && c[1] === 7.5);
    const p = pileProg(t, idx < 0 ? j : idx); if (p <= 0) return;
    const zt = -EXC, zb = lerp(zt, PILE_TIP, p);
    const P = (uu, z) => f === 0 ? iso.P(B1, uu, z) : iso.P(uu, B1, z);
    const pts = [P(u - w, zt), P(u + w, zt), P(u + w, zb), P(u - w, zb)];
    hatch(g, pts, { fill: iso.col(C.conc[1]), color: 'rgba(42,36,51,.35)', sp: 6, edge: 1.4 });
    // tip
    const a = P(u - w, zb), bb = P(u + w, zb), tip = P(u, zb - .8);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(tip[0], tip[1]); g.lineTo(bb[0], bb[1]); g.closePath(); g.fillStyle = iso.col(C.conc[2]); g.fill();
  });
}

// the floor slab polygon: full square, or the L left after the cut
const SQ = [[F0, F0], [F1, F0], [F1, F1], [F0, F1]];
const LSHAPE = [[F0, F0], [F1, F0], [F1, CUT], [CUT, CUT], [CUT, F1], [F0, F1]];
const QUAD = [[CUT, CUT], [F1, CUT], [F1, F1], [CUT, F1]];

function beams(iso, z, cut) {
  const bh = .55, bw = .7, zb = z - bh, bc = C.col;
  // the parts in the L (always in place)
  iso.boxNow(F1 - bw, F0, zb, bw, CUT - F0, bh, bc); iso.boxNow(F0, F1 - bw, zb, CUT - F0, bw, bh, bc);
  // the parts in the near quadrant (slide with the cut skin)
  if (cut.on && cut.a <= 0) return;
  if (cut.on) { iso.alpha = cut.a; iso.push(cut.d * .7, cut.d * .7, 0); }
  iso.boxNow(CUT, F1 - bw, zb, F1 - CUT, bw, bh, bc); iso.boxNow(F1 - bw, CUT, zb, bw, F1 - CUT, bh, bc);
  if (cut.on) { iso.pop(); iso.alpha = 1; }
}
function slabAt(iso, z, h, t, cut) {
  if (!cut.on) { iso.prismNow(SQ, z, h, C.slab); return; }
  iso.prismNow(LSHAPE, z, h, C.slab);
  // hatched section rims on the cut faces
  const g = iso.g, ha = seg(cut.d, 6, 14);
  if (ha > 0) {
    g.save(); g.globalAlpha = ha;
    hatch(g, [iso.P(F1, CUT, z), iso.P(CUT, CUT, z), iso.P(CUT, CUT, z + h), iso.P(F1, CUT, z + h)], { sp: 5, edge: 1.2 });
    hatch(g, [iso.P(CUT, CUT, z), iso.P(CUT, F1, z), iso.P(CUT, F1, z + h), iso.P(CUT, CUT, z + h)], { sp: 5, edge: 1.2 });
    g.restore();
  }
}
function quadSlab(iso, z, h, cut) { // the near skin, sliding away
  if (!cut.on || cut.a <= 0) return;
  iso.alpha = cut.a; iso.push(cut.d * .7, cut.d * .7, 0);
  iso.prismNow(QUAD, z, h, C.slab); iso.pop(); iso.alpha = 1;
}

// building: floor i occupies z ∈ [i*FH, (i+1)*FH]
function building(iso, t) {
  const cut = cutOff(t);
  // foundation blocks + pile tops in the pit
  const zp = -exc(t);
  if (t > T.piles[0] && t < T.slabPour1 + .1) {
    COLS.forEach((c, i) => { const p = pileProg(t, i); if (p > 0) iso.cylNow(c[0], c[1], zp - .4, .55, .4 + .25 * p, C.conc, { n: 14 }); });
  }
  const bp = eo(seg(t, T.blocks, T.blocks + BEAT));
  if (bp > 0 && t < T.slabPour1 + .1) COLS.forEach(c => iso.boxNow(c[0] - 1.1, c[1] - 1.1, zp, 2.2, 2.2, .9 * bp, C.conc));
  // pile driver rig over the current pile
  if (t > T.piles[0] - BEAT && t < T.blocks) {
    const i = clamp(Math.floor((t - T.piles[0]) / BEAT + .15), 0, 7), c = COLS[i], u = ((t - T.piles[i]) / BEAT + 1) % 1;
    const hz = 7 - 5.5 * (u < .25 ? eo(u / .25) : 1 - ss((u - .4) / .6));
    iso.boxNow(c[0] + 1.4, c[1] - .3, zp, .6, .6, 9, C.steel);
    iso.boxNow(c[0] - .7, c[1] - .7, zp + hz, 1.4, 1.4, 1.2, tri('#5B6470'));
  }
  // ground slab pour (rises up from the pit floor)
  const gp = eio(seg(t, T.slabPour0, T.slabPour1));
  if (gp > 0) iso.prismNow(SQ, -EXC, (EXC) * gp, C.conc);

  // floors
  for (let i = 0; i <= NF; i++) {
    const t0 = floorT(i); if (t < t0) break;
    const z0 = i * FH;
    // the slab at the base of floor i (i ≥ 1) drops in with a squash
    if (i >= 1) {
      const lt = (t - t0) / (i < 4 ? 2 * BEAT : BEAT);
      const drop = lt < .45 ? 4 * (1 - eo(lt / .45)) : 0, sq = lt >= .45 && lt < .8 ? Math.sin((lt - .45) / .35 * Math.PI) * .12 : 0;
      if (i < NF || true) beams(iso, z0 - .45 + drop, cut);
      slabAt(iso, z0 - .45 + drop, .45 * (1 - sq), t, cut);
      quadSlab(iso, z0 - .45 + drop, .45, cut);
    }
    if (i === NF) {  // roof: parapet + water tank
      roof(iso, t); break;
    }
    // columns + core + risers, sorted far → near
    const grow = eo(seg(t, t0, t0 + (i < 4 ? BEAT : BEAT * .5)));
    const items = [];
    COLS.forEach(c => items.push([c[0] + c[1], () => iso.boxNow(c[0] - .5, c[1] - .5, z0, 1, 1, FH * grow, C.col)]));
    items.push([CORE[0] + CORE[2] / 2 + CORE[1] + CORE[3] / 2, () => coreSeg(iso, z0, FH * grow, t)]);
    risers(iso, t, z0, grow, items);
    items.sort((a, b) => a[0] - b[0]).forEach(f => f[1]());
    // facade (front two faces), panels drop in floor by floor
    facade(iso, t, i, z0);
  }
}
function coreSeg(iso, z, h, t) {
  const keep = t > T.cut && t < T.restore; // the core keeps its colour while it is the subject
  const k0 = iso.keep; if (keep && t < S.instalacoes) iso.keep = true;
  iso.boxNow(CORE[0], CORE[1], z, CORE[2], CORE[3], h, C.core, {
    decal: (I, bx) => { // door opening on the +x face of every floor (elevator)
      if (h < FH * .9) return;
      const P = (y, zz) => I.P(CORE[0] + CORE[2] + .01, y, zz), y0 = CORE[1] + 1, y1 = CORE[1] + 2.4, zb = z + .1, zt = z + 2.1;
      I.poly([P(y0, zb), P(y1, zb), P(y1, zt), P(y0, zt)], tri('#5E6770')[1]);
      const Q = (x, zz) => I.P(x, CORE[1] + CORE[3] + .01, zz), x0 = CORE[0] + .8, x1 = CORE[0] + 2.2;
      I.poly([Q(x0, zb), Q(x1, zb), Q(x1, zt), Q(x0, zt)], tri('#5E6770')[2]);
    }
  });
  iso.keep = k0;
}
// vertical risers (water, energy, sewer) next to the core, plus horizontal branches under each slab
const RIS = [{ x: -0.3, y: -3.4, c: 'water', r: .32 }, { x: -3.4, y: -0.3, c: 'energy', r: .26 }, { x: -0.4, y: -1.3, c: 'sewer', r: .36 }];
function risers(iso, t, z0, grow, items) {
  const p = seg(t, T.risers, T.risers + 2.4); if (p <= 0) return;
  const top = p * NF * FH; // riser front rises through the floors
  RIS.forEach(R => {
    const h = clamp(top - z0, 0, FH) * (R.c === 'sewer' ? 1 : 1); if (h <= 0) return;
    items.push([R.x + R.y + .01, () => {
      const k0 = iso.keep; iso.keep = t < T.restore; iso.cylNow(R.x, R.y, z0, R.r, h, C[R.c], { n: 12 }); iso.keep = k0;
    }]);
  });
  // branches: a short horizontal run under the slab of this floor
  const bp = seg(top - z0, FH * .5, FH);
  if (bp > 0) items.push([-2, () => {
    const k0 = iso.keep; iso.keep = t < T.restore;
    iso.line3([[RIS[0].x, RIS[0].y, z0 + 2.3], [RIS[0].x + 7 * bp, RIS[0].y, z0 + 2.3]], C.water[1], .2, { now: true, world: true });
    iso.line3([[RIS[1].x, RIS[1].y, z0 + 2.5], [RIS[1].x, RIS[1].y + 7 * bp, z0 + 2.5]], C.energy[1], .14, { now: true, world: true });
    iso.keep = k0;
  }]);
}
function facade(iso, t, i, z0) {
  const t0 = T.glass[i]; if (t < t0) return;
  const lt = (t - t0) / BEAT, drop = 3 * (1 - eo(clamp(lt / .5))), hgt = FH - .55;
  const g = iso.g;
  const panel = (face) => {
    const zb = z0 + .05 + drop, zt = zb + hgt;
    const P = face ? (u, z) => iso.P(u, F1 + .12, z) : (u, z) => iso.P(F1 + .12, u, z);
    const col = face ? C.glass[1] : C.glass[2];
    iso.poly([P(F0, zb), P(F1, zb), P(F1, zt), P(F0, zt)], col);
    // mullions + a sky glint
    g.save(); g.strokeStyle = iso.col(face ? '#5E8F8B' : '#4F7A77'); g.lineWidth = Math.max(1, iso.cam.k * .08);
    for (let u = F0 + 2; u < F1; u += 2.25) { const a = P(u, zb), c2 = P(u, zt); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c2[0], c2[1]); g.stroke(); }
    g.restore();
    const a1 = P(F0 + 3 + (i % 3), zt - .3), a2 = P(F0 + 5 + (i % 3), zt - .3), a3 = P(F0 + 2 + (i % 3), zb + .4), a4 = P(F0 + 1 + (i % 3), zb + .4);
    iso.poly([a1, a2, a3, a4], mix(col, '#FFFFFF', .22));
  };
  panel(0); panel(1);
}
function roof(iso, t) {
  const z = NF * FH;
  // parapet
  const k = .35, ph = .8;
  iso.boxNow(F0, F0, z, F1 - F0, k, ph, C.conc); iso.boxNow(F0, F0, z, k, F1 - F0, ph, C.conc);
  // water tank lands
  const lt = (t - T.tank) / BEAT;
  if (lt > 0) {
    const drop = lt < .5 ? 6 * (1 - eo(lt / .5)) : 0, sq = lt > .5 && lt < .9 ? Math.sin((lt - .5) / .4 * Math.PI) * .18 : 0;
    iso.boxNow(CORE[0] - .2, CORE[1] - .2, z + drop, CORE[2] + .4, CORE[3] + .4, 2.2 * (1 - sq), C.tank);
  }
  iso.boxNow(F1 - k, F0, z, k, F1 - F0, ph, C.conc); iso.boxNow(F0, F1 - k, z, F1 - F0, k, ph, C.conc);
}

// tower crane: mast behind the building, jib drawn after it
const CR = [-17, 2];
function craneH(t) { const up = eo(seg(t, S.estrutura - 1.2, S.estrutura)), lift = eio(seg(t, T.tank + .6, T.tank + 2.2)); return up > 0 ? 40 * up + 60 * lift : 0; }
function craneMast(iso, t) {
  const h = craneH(t); if (h <= .1) return; const zb = h - 40; if (zb > 46) return;
  const zlo = Math.max(zb, 0), mh = h - zlo; if (mh <= .1) return;
  iso.boxNow(CR[0] - .7, CR[1] - .7, zlo, 1.4, 1.4, mh, C.steel, {
    decal: (I, B) => { const g = I.g; g.save(); g.strokeStyle = I.col(C.steel[2]); g.lineWidth = Math.max(1, I.cam.k * .07); for (let z = zlo; z < h - 1.4; z += 1.4) { const a = I.P(B.x + B.w, B.y, z), c = I.P(B.x + B.w, B.y + B.d, z + 1.4); const a2 = I.P(B.x, B.y + B.d, z), c2 = I.P(B.x + B.w, B.y + B.d, z + 1.4); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.moveTo(a2[0], a2[1]); g.lineTo(c2[0], c2[1]); g.stroke(); } g.restore(); }
  });
}
function craneJib(iso, t) {
  const h = craneH(t); if (h <= .1 || h > 90) return; const zt = h;
  const ang = .78 + .35 * Math.sin((t - S.estrutura) * .55) - .3 * seg(t, S.nucleo, S.fachada);
  iso.push(CR[0], CR[1], zt, ang);
  iso.boxNow(-6, -.5, 0, 26, 1, .9, C.steel);           // jib + counter-jib
  iso.boxNow(-6, -.9, -.9, 3.2, 1.8, .9, tri('#6B6F78'));  // counterweight
  iso.boxNow(-.8, -.8, .9, 1.6, 1.6, 1.6, C.steel);       // cab / apex
  const tx = 9 + 6 * (.5 + .5 * Math.sin((t - S.estrutura) * .9));
  iso.line3([[tx, 0, 0], [tx, 0, -8]], INK, 1.5, { now: true });
  iso.boxNow(tx - .5, -.5, -9, 1, 1, .9, tri('#5B6470'));
  iso.pop();
}

// ---------- the load arrow (title + the turn) ----------
function arrowShape(iso, x, y, z, s, sq = 0) {
  // a downward arrow standing on plane xz (faces the viewer-left), extruded in y
  const w = 1.4 * s, hw = 2.8 * s, sh = 4.2 * s * (1 - sq), hh = 2.6 * s * (1 - sq * .5);
  const pts2 = [[-w, 0], [w, 0], [w, sh], [hw, sh], [0, sh + hh], [-hw, sh], [-w, sh]];
  const D = 1.2 * s, W3 = pts2.map(p => [x + p[0] * .7071, y - p[0] * .7071, z - p[1] + sh + hh]);
  const k0 = iso.keep; iso.keep = true;
  const t3 = tri(C.coral);
  const front = W3.map(p => [p[0] + D * .5, p[1] + D * .5, p[2]]), backp = W3.map(p => [p[0] - D * .5, p[1] - D * .5, p[2]]);
  const sides = [];
  for (let i = 0; i < front.length; i++) { const j = (i + 1) % front.length, f = [backp[i], backp[j], front[j], front[i]]; const m = f.reduce((a, p) => a + p[0] + p[1] + p[2], 0); sides.push([m, f]); }
  sides.sort((a, b) => a[0] - b[0]).forEach(([, f]) => iso.face3(f, t3, { both: true, out: [f[0][0] - x, f[0][1] - y, 0] }));
  iso.face3(front, t3, { both: true, color: t3[0] });
  iso.keep = k0;
}

function titleArrow(iso, t) {
  if (t > S.terreno + 1) return;
  const land = T.arrowLand, fall = t < land ? 1 - eo(seg(t, .4, land)) : 0;
  const after = (t - land) / BEAT, sq = after > 0 && after < 1 ? Math.sin(after * Math.PI) * .3 * (1 - after) : 0;
  const flat = eio(seg(t, S.terreno + .2, S.terreno + .8));
  if (flat >= .98) return;
  arrowShape(iso, -1, -1, 0.05 + 14 * fall, 1.25, Math.max(sq, flat * .97));
}
function titleText(iso, t) {
  const a = seg(t, .15, 1.6);
  if (a <= 0 || t > S.fundacao) return;
  const out = eio(seg(t, S.terreno + 2, S.terreno + 3)); // slides down into the ground (motion, not alpha)
  const words = [['COMO UM', 0], ['PRÉDIO', 1], ['FICA DE PÉ?', 2]];
  words.forEach(([w, i]) => {
    const wa = back(seg(t, .15 + i * BEAT * .5, .15 + i * BEAT * .5 + .45), 1.6);
    if (wa <= 0) return;
    const z = (1 - wa) * 4 - out * 3;
    if (z < -2.9) return;
    iso.text3Now(w, -36 + i * 4.6, -2, Math.max(0, z), { plane: 'xy', size: 3.6, extrude: .9 * clamp(wa), tri: [PAPER, '#D9CDB4', '#B8A98A'], face: INK, weight: 700, track: 6 });
  });
}

// ---------- the load path (the turn) ----------
const PATHS = [
  { pts: [[7.5, 7.5, 30.4], [7.5, 7.5, 0], [7.5, 7.5, -EXC], [8.99, 7.5, -EXC], [8.99, 7.5, PILE_TIP - .6]], w: 7 },
  { pts: [[7.5, -1, 30.4], [7.5, -1, 0], [7.5, -1, -EXC], [8.99, -1, -EXC], [8.99, -1, PILE_TIP - .6]], w: 5 },
  { pts: [[-1, 7.5, 30.4], [-1, 7.5, 0], [-1, 7.5, -EXC], [-1, 8.99, -EXC], [-1, 8.99, PILE_TIP - .6]], w: 5 },
];
function pathLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]); return L; }
function partial(p, f) {
  const L = pathLen(p) * f, out = [p[0]]; let acc = 0;
  for (let i = 1; i < p.length; i++) { const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]); if (acc + l >= L) { const u = (L - acc) / l; out.push([lerp(p[i - 1][0], p[i][0], u), lerp(p[i - 1][1], p[i][1], u), lerp(p[i - 1][2], p[i][2], u)]); return out; } acc += l; out.push(p[i]); }
  return out;
}
const loadF = t => eio(seg(t, T.loadStart, T.loadEnd));
function loadPath(iso, t) {
  const f = loadF(t); if (f <= 0) return;
  const g = iso.g, fade = 1;
  g.save(); g.globalAlpha = fade;
  PATHS.forEach((P, j) => {
    const q = partial(P.pts, f), sc = q.map(p => iso.P(...p));
    g.strokeStyle = C.coral; g.lineWidth = P.w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); sc.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    // moving chevrons along the path
    const h = sc[sc.length - 1], pv = sc[Math.max(0, sc.length - 2)];
    const ang = Math.atan2(h[1] - pv[1], h[0] - pv[0]) || Math.PI / 2, s = P.w * 2.6;
    g.beginPath(); g.moveTo(h[0] + Math.cos(ang) * s, h[1] + Math.sin(ang) * s);
    g.lineTo(h[0] + Math.cos(ang + 2.4) * s, h[1] + Math.sin(ang + 2.4) * s); g.lineTo(h[0] + Math.cos(ang - 2.4) * s, h[1] + Math.sin(ang - 2.4) * s); g.closePath();
    g.fillStyle = C.coral; g.fill();
  });
  // the rock answers: a fan of pressure under the piles
  const r = seg(t, T.rock - .2, T.rock + 1.2);
  if (r > 0) PATHS.forEach(P => {
    const e = P.pts[P.pts.length - 1], face = e[0] > 8.9 ? 0 : 1;
    const FP = face === 0 ? [iso.P(B1, B0, Z_CLAY), iso.P(B1, B1, Z_CLAY), iso.P(B1, B1, Z_ROCK), iso.P(B1, B0, Z_ROCK)] : [iso.P(B0, B1, Z_CLAY), iso.P(B1, B1, Z_CLAY), iso.P(B1, B1, Z_ROCK), iso.P(B0, B1, Z_ROCK)];
    g.save(); g.beginPath(); FP.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
    for (let k = 1; k <= 3; k++) {
      const rr = eo(r) * k * .75, pts = [];
      for (let a = 0; a <= 20; a++) { const th = Math.PI * (a / 20), u = Math.cos(th) * rr, v = -Math.sin(th) * rr; pts.push(face === 0 ? iso.P(8.99, e[1] + u, e[2] + v) : iso.P(e[0] + u, 8.99, e[2] + v)); }
      g.strokeStyle = C.coral; g.globalAlpha = 1 - (k - 1) * .28; g.lineWidth = 3; g.setLineDash([]);
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    }
    g.restore();
  });
  g.restore();
}

// ---------- wind (core section) ----------
function wind(iso, t) {
  const a = seg(t, T.wind - .4, T.wind + .6) * (1 - seg(t, S.instalacoes - .4, S.instalacoes + .2));
  if (a <= 0) return; const g = iso.g;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const z = 4 + i * 3 + hash(i) * 1.5, x = -7 + (i % 3) * 6 + hash(i + 4) * 2, ph = (t * 1.1 + hash(i * 2.3)) % 1;
    const y0 = 34 - ph * 20, y1 = y0 - 7, stop = F1 + 1.2;
    const ya = Math.max(y1, stop), yb = Math.max(y0, stop);
    if (yb - ya < .2) continue;
    const p0 = iso.P(x, yb, z), p1 = iso.P(x, ya, z);
    g.globalAlpha = a * Math.min(1, 1.6 * Math.sin(Math.PI * clamp(ph * 1.15)));
    g.strokeStyle = '#4E77A3'; g.lineWidth = 4; g.setLineDash([]);
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
    const an = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    g.beginPath(); g.moveTo(p1[0] + Math.cos(an) * 12, p1[1] + Math.sin(an) * 12); g.lineTo(p1[0] + Math.cos(an + 2.5) * 12, p1[1] + Math.sin(an + 2.5) * 12); g.lineTo(p1[0] + Math.cos(an - 2.5) * 12, p1[1] + Math.sin(an - 2.5) * 12); g.closePath(); g.fillStyle = '#4E77A3'; g.fill();
  }
  g.restore();
  const lp = iso.P(-1, 24, 18); g.save(); g.globalAlpha = a; haloText(g, 'VENTO', lp[0], lp[1], { font: '600 26px Jost', track: 3.5, align: 'center', color: '#3D6290' }); g.restore();
}

// ---------- insets ----------
function insetElevator(g, cx, cy, R, t) {
  g.fillStyle = '#E9E4D8'; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  // shaft (left) and stairs (right) in a mini section
  const s = R / 10;
  g.fillStyle = '#8F98A1'; g.fillRect(cx - 7 * s, cy - 10 * s, 1.2 * s, 20 * s); g.fillRect(cx - .6 * s, cy - 10 * s, 1.2 * s, 20 * s); g.fillRect(cx + 6.2 * s, cy - 10 * s, 1.2 * s, 20 * s);
  for (let k = -2; k <= 2; k++) { g.fillStyle = '#C9CDD0'; g.fillRect(cx - 7 * s, cy + k * 4.4 * s, 14.4 * s, .7 * s); }
  // elevator cab moving
  const cyab = cy + 6 * s - ((t * .9) % 2 < 1 ? (t * .9) % 1 : 2 - (t * .9) % 2) * 11 * s;
  g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 3.2 * s, cy - 10 * s); g.lineTo(cx - 3.2 * s, cyab - 2.2 * s); g.stroke();
  g.fillStyle = '#E3A23B'; g.fillRect(cx - 5.4 * s, cyab - 2.2 * s, 4.4 * s, 3.8 * s);
  g.fillStyle = '#B57F22'; g.fillRect(cx - 5.4 * s, cyab + 1.2 * s, 4.4 * s, .4 * s);
  // stairs zigzag
  g.strokeStyle = INK; g.lineWidth = 2; g.beginPath();
  for (let k = -2; k < 2; k++) { const y0 = cy + (k + 1) * 4.4 * s, y1 = cy + k * 4.4 * s + .7 * s; const L = k % 2 ? [cx + 1.2 * s, cx + 5.6 * s] : [cx + 5.6 * s, cx + 1.2 * s]; for (let st = 0; st <= 5; st++) { const x = lerp(L[0], L[1], st / 5), y = lerp(y0, y1, st / 5); st ? (g.lineTo(x, y + (y0 - y1) / 5), g.lineTo(x, y)) : g.moveTo(x, y); } }
  g.stroke();
  haloText(g, 'ELEVADOR', cx - 3 * s, cy + 7.4 * s, { font: `600 ${Math.round(R * .1)}px Jost`, align: 'center', track: 2 });
  haloText(g, 'ESCADA', cx + 3.4 * s, cy + 7.4 * s, { font: `600 ${Math.round(R * .1)}px Jost`, align: 'center', track: 2 });
}
function insetPipes(g, cx, cy, R, t) {
  g.fillStyle = '#EEE8DA'; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  const s = R / 10;
  // floor slab and ceiling
  g.fillStyle = '#C9CDD0'; g.fillRect(cx - R, cy + 6 * s, 2 * R, 1.6 * s); g.fillRect(cx - R, cy - 8 * s, 2 * R, 1.2 * s);
  // water pipe → faucet / sink
  g.strokeStyle = '#4F8FC7'; g.lineWidth = 1.1 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - 9 * s, cy - 5.6 * s); g.lineTo(cx + 2 * s, cy - 5.6 * s); g.lineTo(cx + 2 * s, cy - 1 * s); g.lineTo(cx + 3.6 * s, cy - 1 * s); g.stroke();
  // flowing dashes
  g.strokeStyle = '#BFE0FA'; g.lineWidth = .35 * s; g.setLineDash([s, 1.4 * s]); g.lineDashOffset = -t * 40;
  g.beginPath(); g.moveTo(cx - 9 * s, cy - 5.6 * s); g.lineTo(cx + 2 * s, cy - 5.6 * s); g.lineTo(cx + 2 * s, cy - 1 * s); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#FBF6EA'; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx + 1 * s, cy + .6 * s); g.lineTo(cx + 7 * s, cy + .6 * s); g.lineTo(cx + 6 * s, cy + 2.6 * s); g.lineTo(cx + 2 * s, cy + 2.6 * s); g.closePath(); g.fill(); g.stroke();
  // sewer down
  g.strokeStyle = '#8C7C6E'; g.lineWidth = 1.4 * s; g.beginPath(); g.moveTo(cx + 4 * s, cy + 2.8 * s); g.lineTo(cx + 4 * s, cy + 9 * s); g.stroke();
  // electric wire → socket and lamp
  g.strokeStyle = '#E3A23B'; g.lineWidth = .6 * s; g.beginPath(); g.moveTo(cx - 9 * s, cy - 6.8 * s); g.lineTo(cx - 4 * s, cy - 6.8 * s); g.lineTo(cx - 4 * s, cy - 5.2 * s); g.moveTo(cx - 6.5 * s, cy - 6.8 * s); g.lineTo(cx - 6.5 * s, cy + 2 * s); g.stroke();
  g.fillStyle = '#FBF6EA'; g.fillRect(cx - 7.5 * s, cy + 2 * s, 2 * s, 2 * s); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(cx - 7.5 * s, cy + 2 * s, 2 * s, 2 * s);
  const on = .5 + .5 * Math.sin(t * 6);
  g.beginPath(); g.arc(cx - 4 * s, cy - 4.2 * s, 1 * s, 0, TAU); g.fillStyle = `rgba(243,200,90,${.6 + .4 * on})`; g.fill(); g.stroke();
  haloText(g, 'ÁGUA', cx - 6 * s, cy - 6.6 * s + 2.6 * s, { font: `600 ${Math.round(R * .09)}px Jost`, align: 'center', track: 2, color: '#2F6A9E' });
}

// ---------- captions (map-label cards) ----------
function caption(g, t) {
  for (const c of CAPS) {
    if (t < c.t0 || t > c.t1 + .3) continue;
    const a = seg(t, c.t0, c.t0 + .2), w = seg(t, c.t0 + .15, c.t0 + .55), out = seg(t, c.t1, c.t1 + .3);
    g.save(); g.font = '500 40px Jost'; const tw = g.measureText(c.text).width;
    const W = tw + 110, H = 74, x = 960 - W / 2, y = 1080 - 64 - H + out * 8;
    g.globalAlpha = 1 - out;
    // card: border draws first
    g.beginPath(); g.roundRect(x, y, W, H, 10); g.fillStyle = `rgba(251,246,234,${.96 * a})`; g.fill();
    g.strokeStyle = INK; g.lineWidth = 2; const per = 2 * (W + H); g.setLineDash([per * a, per]); g.stroke(); g.setLineDash([]);
    // tiny iso cube chip in the accent of the section
    const cx = x + 38, cy = y + H / 2, s = 11, ch = tri(capChip(t));
    const poly = (pts, col) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(cx + p[0], cy + p[1]) : g.moveTo(cx + p[0], cy + p[1])); g.closePath(); g.fillStyle = col; g.fill(); };
    if (a > .5) { poly([[0, -s], [s * C30, -s / 2], [0, 0], [-s * C30, -s / 2]], ch[0]); poly([[-s * C30, -s / 2], [0, 0], [0, s], [-s * C30, s / 2]], ch[1]); poly([[0, 0], [s * C30, -s / 2], [s * C30, s / 2], [0, s]], ch[2]); }
    // text wipes in
    g.save(); g.beginPath(); g.rect(x + 66, y, (W - 66) * w, H); g.clip();
    g.fillStyle = INK; g.textBaseline = 'middle'; g.fillText(c.text, x + 70, y + H / 2 + 2); g.restore();
    g.restore();
  }
}
function capChip(t) {
  if (t < S.fundacao) return '#A77850'; if (t < S.estrutura) return '#B8BEC4'; if (t < S.nucleo) return '#A3ABB3';
  if (t < S.instalacoes) return '#8F98A1'; if (t < S.fachada) return '#4F8FC7'; if (t < S.peso) return '#86BDB8'; return C.coral;
}

// ---------- labels ----------
function labels(iso, t) {
  const L = (x, y, z, o, t0, t1) => { const a = seg(t, t0, t0 + 1.1) , f = 1 - seg(t, t1, t1 + .35); if (a > 0 && f > 0) pin(iso, x, y, z, { ...o, a, fade: f }); };
  // strata
  L(B1, 2, -1.5, { title: 'SOLO', dir: 1, up: 40, len: 60, ts: 24 }, 4.2, 8.6);
  L(B1, -6, -5.5, { title: 'ARGILA', dir: 1, up: 30, len: 120, ts: 24 }, 4.8, 8.6);
  L(B1, -14, -11, { title: 'ROCHA FIRME', dir: 1, up: 20, len: 160, ts: 24 }, 5.4, 8.6);
  // piles
  L(B1, 7.5, -7, { title: 'ESTACAS', num: '8', unit: 'UNIDADES', dir: 1, up: 70, len: 70, ts: 24 }, T.piles[3], S.estrutura - .3);
  L(-1, 7.5, -0.9, { title: 'BLOCOS', dir: -1, up: 120, len: 70, ts: 24 }, T.blocks, S.estrutura - .3);
  // structure
  L(7.5, 7.5, 6, { title: 'PILAR', dir: 1, up: 30, len: 50, ts: 22 }, T.floors[2], S.nucleo - .4);
  L(F1, 0, 9 - .2, { title: 'LAJE', dir: 1, up: 50, len: 50, ts: 22 }, T.floors[3], S.nucleo - .4);
  const nf = Math.min(NF, T.floors.filter(x => t >= x).length);
  if (t > T.floors[0] && t < S.nucleo - .2) pin(iso, F0, F1, nf * FH, { title: 'ANDARES', num: String(nf), dir: -1, up: 40, len: 60, a: seg(t, T.floors[0], T.floors[0] + 1), fade: 1 - seg(t, S.nucleo - .6, S.nucleo - .2), ts: 22 });
  // core + installations
  L(CORE[0] + CORE[2], CORE[1] + CORE[3], 22, { title: 'NÚCLEO', dir: 1, up: 60, len: 80, ts: 24 }, T.cut + .8, S.instalacoes - .3);
  L(RIS[0].x, RIS[0].y, 19, { title: 'ÁGUA', dir: 1, up: 40, len: 90, ts: 22, dot: C.water[1] }, T.risers + .8, S.fachada - .3);
  L(RIS[1].x, RIS[1].y, 13, { title: 'ENERGIA', dir: -1, up: 40, len: 80, ts: 22, dot: C.energy[1] }, T.risers + 1.2, S.fachada - .3);
  L(RIS[2].x, RIS[2].y, 7, { title: 'ESGOTO', dir: 1, up: 30, len: 120, ts: 22, dot: C.sewer[1] }, T.risers + 1.6, S.fachada - .3);
  // facade
  L(F1, -5, 18, { title: 'FACHADA DE VIDRO', dir: 1, up: 40, len: 60, ts: 22 }, T.glass[3], S.peso - .2);
  L(CORE[0] + CORE[2] / 2, CORE[1] + CORE[3] / 2, NF * FH + 2.4, { title: "CAIXA D'ÁGUA", dir: 1, up: 50, len: 60, ts: 22 }, T.tank + .4, S.peso - .2);
  // the load path stations
  const f = loadF(t), stations = [[.02, 'LAJE', 7.5, 7.5, 30], [.3, 'VIGA', 7.5, 7.5, 21], [.55, 'PILAR', 7.5, 7.5, 9], [.8, 'ESTACA', 8.99, 7.5, -6], [.97, 'ROCHA', 8.99, 7.5, -12.5]];
  if (t > T.loadStart && t < S.final + 3.5) stations.forEach(([fx, name, x, y, z], i) => {
    const a = seg(f, fx, Math.min(1, fx + .12)); if (a <= 0) return;
    const k0 = iso.keep; pin(iso, x, y, z, { title: name, dir: 1, up: 26, len: 46, a: Math.min(1, a * 1.4), fade: 1 - seg(t, S.final + 2.5, S.final + 3.5), ts: 24, dot: C.coral });
  });
}

// ---------- end legend ----------
function legend(g, t) {
  const a = seg(t, S.final + 2.6, S.final + 3.4); if (a <= 0) return;
  const x = 90, y = 90, W = 520, rows = [['CONCRETO (ESTRUTURA)', '#B8BEC4'], ['NÚCLEO', '#8F98A1'], ['ÁGUA', '#4F8FC7'], ['ENERGIA', '#E3A23B'], ['ESGOTO', '#8C7C6E'], ['VIDRO', '#86BDB8'], ['CAMINHO DO PESO', C.coral]];
  const H = 150 + rows.length * 44 + 40;
  g.save(); g.globalAlpha = eo(a);
  g.beginPath(); g.roundRect(x, y + (1 - eo(a)) * 20, W, H, 12); g.fillStyle = 'rgba(251,246,234,.97)'; g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
  const yy = y + (1 - eo(a)) * 20;
  haloText(g, 'COMO UM PRÉDIO', x + 32, yy + 58, { font: '700 36px Jost', track: 4, halo: false });
  haloText(g, 'FICA DE PÉ', x + 32, yy + 100, { font: '700 36px Jost', track: 4, halo: false, color: C.coral });
  g.fillStyle = INK; g.fillRect(x + 32, yy + 122, W - 64, 2);
  rows.forEach(([name, col], i) => {
    const ry = yy + 160 + i * 44, ch = tri(col), cx = x + 46, cy = ry - 8, s = 12;
    const p = (pts, c) => { g.beginPath(); pts.forEach((q, j) => j ? g.lineTo(cx + q[0], cy + q[1]) : g.moveTo(cx + q[0], cy + q[1])); g.closePath(); g.fillStyle = c; g.fill(); };
    p([[0, -s], [s * C30, -s / 2], [0, 0], [-s * C30, -s / 2]], ch[0]); p([[-s * C30, -s / 2], [0, 0], [0, s], [-s * C30, s / 2]], ch[1]); p([[0, 0], [s * C30, -s / 2], [s * C30, s / 2], [0, s]], ch[2]);
    haloText(g, name, x + 74, ry, { font: '500 24px Jost', track: 2, halo: false });
  });
  haloText(g, 'SEM ESCALA', x + 32, yy + H - 26, { font: '600 18px Jost', track: 4, halo: false, color: '#7A7068' });
  g.restore();
}

// ---------- frame ----------
export function render(g, t, Q) {
  const iso = new Iso(g);
  iso.cam = camAt(t);
  if (Q && Q.has('k')) iso.cam = { x: +Q.get('cx') || 0, y: +Q.get('cy') || 0, z: +Q.get('cz') || 0, k: +Q.get('k') };
  // focus + context: everything greys at the turn, only the load keeps its colour
  const ds = seg(t, T.silence1, T.silence1 + .6) * (1 - seg(t, S.final + 2.6, S.final + 4));
  const coreFocus = .55 * seg(t, T.cut + .6, T.cut + 1.2) * (1 - seg(t, S.instalacoes - .4, S.instalacoes));
  const pipeFocus = .55 * seg(t, T.risers, T.risers + .6) * (1 - seg(t, S.fachada - .4, S.fachada));
  iso.desat = Math.max(ds, coreFocus, pipeFocus);
  background(g, iso, t);
  board(iso, t);
  pileSections(iso, t);
  titleText(iso, t);
  craneMast(iso, t);
  building(iso, t);
  craneJib(iso, t);
  titleArrow(iso, t);
  wind(iso, t);
  loadPath(iso, t);
  if (!(Q && Q.has('nolabels'))) labels(iso, t);
  // insets
  const ia = seg(t, T.insetCore, T.insetCore + .9) * (1 - seg(t, S.instalacoes - .5, S.instalacoes));
  if (ia > 0) { const p = iso.P(CORE[0] + CORE[2], CORE[1] + CORE[3] / 2, 16); inset(iso, p[0], p[1], 1540, 380, 220, ia, (gg, cx, cy, R) => insetElevator(gg, cx, cy, R, t)); }
  const ib = seg(t, T.insetPipes, T.insetPipes + .9) * (1 - seg(t, S.fachada - .5, S.fachada));
  if (ib > 0) { const p = iso.P(RIS[0].x + 4, RIS[0].y, 3 * 4 + 2.3); inset(iso, p[0], p[1], 1540, 400, 220, ib, (gg, cx, cy, R) => insetPipes(gg, cx, cy, R, t)); }
  // cut line on the slabs before the skin slides away
  const cl = seg(t, T.cut, T.cut + .3) * (1 - seg(t, T.cut + .5, T.cut + .8));
  if (cl > 0) for (let i = 1; i <= NF; i++) { const z = i * FH; cutLine(g, [iso.P(F1, CUT, z), iso.P(CUT, CUT, z), iso.P(CUT, F1, z)], cl, { lw: 2 }); }
  legend(g, t);
  if (!(Q && Q.has('nosub'))) caption(g, t);
}

// ---------- sound / cue events ----------
export function events() {
  const ev = [];
  ev.push({ t: .15, type: 'title' }, { t: T.arrowLand, type: 'arrowLand' }, { t: S.terreno, type: 'whoosh' });
  ev.push({ t: T.dig0, type: 'digStart' }, { t: T.dig1, type: 'digEnd' });
  T.piles.forEach((t, i) => ev.push({ t: t + BEAT * .25, type: 'pile', i }));
  ev.push({ t: T.blocks, type: 'blocks' }, { t: T.slabPour0, type: 'pourStart' }, { t: T.slabPour1, type: 'pourEnd' });
  ev.push({ t: S.estrutura - 1.2, type: 'craneUp' });
  T.floors.forEach((t, i) => ev.push({ t, type: 'columns', i }, { t: t + (i < 4 ? 2 * BEAT : BEAT) * .45, type: 'slab', i }));
  ev.push({ t: T.roof, type: 'roof' });
  ev.push({ t: T.cut, type: 'cut' }, { t: T.cut + .3, type: 'slide' }, { t: T.wind - .4, type: 'windStart' }, { t: S.instalacoes, type: 'windEnd' });
  ev.push({ t: T.insetCore, type: 'inset' }, { t: T.risers, type: 'risers' }, { t: T.insetPipes, type: 'inset' });
  ev.push({ t: T.restore, type: 'slideBack' });
  T.glass.forEach((t, i) => ev.push({ t: t + BEAT * .5, type: 'glass', i }));
  ev.push({ t: T.tank + BEAT * .5, type: 'tank' }, { t: T.tank + .8, type: 'craneDown' });
  ev.push({ t: T.silence0, type: 'silence0' }, { t: T.silence1, type: 'silence1' }, { t: T.loadStart, type: 'loadStart' });
  [.02, .3, .55, .8, .97].forEach((f, i) => { // when the head passes each station (inverse of eio on the path)
    let lo = T.loadStart, hi = T.loadEnd; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; loadF(m) < f + .0 ? lo = m : hi = m; }
    ev.push({ t: +lo.toFixed(3), type: 'station', i });
  });
  ev.push({ t: T.rock, type: 'rock' }, { t: T.pull, type: 'pull' }, { t: S.final + 2.6, type: 'legend' });
  CAPS.forEach((c, i) => ev.push({ t: c.t0, type: 'caption', i }));
  return ev.sort((a, b) => a.t - b.t);
}

// texts on screen, for readcheck
export function texts(t) {
  const out = [];
  CAPS.forEach((c, i) => { if (t >= c.t0 + .55 && t <= c.t1) out.push({ id: 'cap' + i, text: c.text, x0: 300, y0: 940, x1: 1620, y1: 1016 }); });
  if (t > 1.6 && t < S.terreno + 2) out.push({ id: 'title', text: 'COMO UM PRÉDIO FICA DE PÉ?', x0: 200, y0: 200, x1: 1700, y1: 900 });
  if (t > S.final + 3.4) out.push({ id: 'legend', text: 'COMO UM PRÉDIO FICA DE PÉ', x0: 90, y0: 90, x1: 610, y1: 700 });
  return out;
}
