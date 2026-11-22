// "Juros compostos" — a short Chalkboard sample. The whole film as data: strokes, times, the one wipe, camera, texts, sound events.
// World units: the board's slate (x 0…6400, y 0…1700); everything is written on the front-left panel (layer 'FL', x 0…3200).
import { clamp, lerp, eio } from '/core/lib.js';
import { Stroke, catmull } from './chalk.js';
import { writeLatin, latinWidth } from './hand.js';

const needOf = txt => Math.max(1.5, [...txt].filter(c => !/\s/.test(c)).length / 15 + 1.5);

export function build(W = 1920, H = 1080) {
  const S = [], TX = [], EV = [], T = {};
  const add = (arr, phase = 'pre') => { arr.forEach(s => { s.layer = 'FL'; s.phase = phase; S.push(s); }); return arr; };
  const text = (id, txt, strokes, t1 = 1e9, pad = 8) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of strokes) for (const [x, y] of s.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    TX.push({ id, text: txt, layer: 'FL', box: [x0 - pad, y0 - pad, x1 + pad, y1 + pad], t0: strokes[0].t0, t1 });
  };
  const line = (pts, o, t0, dur) => { const s = new Stroke(o.smooth ? catmull(pts, 10) : pts, { kind: 'write', taper: .2, taperLen: .2, land: .6, skip: .14, endSpecks: true, specks: .6, ...o }); s.t0 = t0; s.t1 = t0 + dur; return s; };
  const arrow = (x0, y, x1, t0, color = 'white') => {
    const a = line([[x0, y], [x1, y - 3]], { w: 7, color, taper: .05 }, t0, .16);
    const h = line([[x1 - 34, y - 22], [x1, y - 3], [x1 - 34, y + 18]], { w: 7, color, taper: .1 }, t0 + .17, .1);
    return [a, h];
  };
  const X0 = 330;

  // ───── title and the question
  const ti = add(writeLatin('Juros compostos', X0, 330, 130, .15, { seed: 3, lspeed: 55 }));
  const ul = add([line([[X0 - 10, 380], [X0 + latinWidth('Juros compostos', 130) + 10, 372]], { w: 8, color: 'white', taper: .1 }, ti.end + .05, .3)]);
  text('title', 'Juros compostos', ti);
  const q1 = add(writeLatin('R$ 1.000 a 10% ao ano', X0, 640, 100, ul[0].t1 + .25, { seed: 7, lspeed: 70 }));
  text('q1', 'R$ 1.000 a 10% ao ano', q1);
  const q2 = add(writeLatin('Em 10 anos:', X0, 900, 100, q1.end + .3, { seed: 9, lspeed: 70 }));
  text('q2', 'Em 10 anos:', q2);

  // ───── the answer everybody writes first (white), with its reasoning underneath; both get wiped
  const AX = X0 + latinWidth('Em 10 anos:', 100) + 110, AW = latinWidth('R$ 2.000 ?', 120);
  const wrong = add(writeLatin('R$ 2.000 ?', AX, 900, 120, q2.end + .35, { seed: 11, lspeed: 70 }));
  const why = add(writeLatin('10% x 10 = 100%', AX + 10, 1040, 62, wrong.end + .15, { seed: 13, lspeed: 90 }));
  T.wipe0 = +Math.max(why.end + 1.0, wrong[0].t0 + needOf('R$ 2.000 ?') + .3, why[0].t0 + needOf('10% x 10 = 100%') + .2).toFixed(2);
  T.wipe1 = T.wipe0 + .7;
  [...wrong, ...why].forEach(s => s.wiped = true);
  text('wrong', 'R$ 2.000 ?', wrong, T.wipe0 + .3); text('why', '10% x 10 = 100%', why, T.wipe0 + .3);
  const WP = [[AX - 40, 830], [AX + AW * .35, 845], [AX + AW * .7, 838], [AX + AW + 60, 850], [AX + AW + 90, 950], [AX + AW * .7, 1010], [AX + AW * .35, 1022], [AX - 40, 1015]];
  const wipe = { t0: T.wipe0, t1: T.wipe1, w: 250, path: catmull(WP, 12) };
  EV.push({ t: T.wipe0, type: 'wipe', d: .7 });

  // ───── the right answer, in place, in the accent chalk
  const right = add(writeLatin('R$ 2.594', AX, 905, 140, T.wipe1 + .25, { seed: 15, lspeed: 55, color: 'orange' }), 'post');
  const ru = add([line([[AX - 10, 960], [AX + latinWidth('R$ 2.594', 140) + 10, 952]], { w: 9, color: 'orange', taper: .1 }, right.end + .08, .28)], 'post');
  text('right', 'R$ 2.594', right);
  EV.push({ t: ru[0].t1, type: 'tap', big: 1 });

  // ───── why: each year's interest also earns interest. Numbers in white, the growing interest in orange
  const RY = 1330, CAP = 72, nums = ['1.000', '1.100', '1.210', '1.331'], incs = ['+100', '+110', '+121'];
  let x = X0, t = ru[0].t1 + .5; const row = [];
  T.row = t;
  nums.forEach((nm, i) => {
    const s = add(writeLatin(nm, x, RY, CAP, t, { seed: 20 + i, lspeed: 90 }), 'post'); row.push(...s); t = s.end + .05;
    x += latinWidth(nm, CAP) + 40;
    if (i < incs.length) {
      const ar = add(arrow(x, RY - CAP / 2, x + 170, t), 'post'); row.push(...ar); t = ar[1].t1 + .03;
      const inc = add(writeLatin(incs[i], x + 8, RY - CAP - 30, 52, t, { seed: 30 + i, lspeed: 110, color: 'orange' }), 'post'); t = inc.end + .12;
      text('inc' + i, incs[i], inc);
      x += 210;
    }
  });
  const dots = add(writeLatin('...', x, RY, CAP, t, { seed: 40, lspeed: 90 }), 'post'); t = dots.end;
  text('row', nums.join(' ') + ' ...', row);
  const fin = add(writeLatin('juros sobre juros', X0, 1560, 90, t + .4, { seed: 41, lspeed: 70 }), 'post');
  text('fin', 'juros sobre juros', fin);
  T.wall = +(Math.max(fin.end + needOf('juros sobre juros') - .6, row[0].t0 + needOf(nums.join(' ') + ' ...'))).toFixed(2);
  EV.push({ t: T.wall, type: 'bell' });
  T.DUR = +(T.wall + 3.4).toFixed(2);
  T.back0 = 1e9;

  // ───── camera: [t, cx, cy, s] keys per shot (s for a 1920-wide frame); eased between keys
  const TW = latinWidth('Juros compostos', 130), RIGHT = AX + AW + 40, MF = { cx: (X0 + Math.max(RIGHT, x + 200)) / 2, cy: 960, s: .62 };                    // the whole lesson on the panel
  const shots = [
    { t0: 0, keys: [[0, X0 + TW / 2, 330, 1.0], [ti.end, X0 + TW / 2 + 20, 340, .95], [q1[0].t0 + .4, (X0 + RIGHT) / 2, 620, .7], [q2.end, (X0 + RIGHT) / 2, 700, .7]] },
    { t0: wrong[0].t0 - .2, keys: [[wrong[0].t0 - .2, (X0 + RIGHT) / 2, 720, .7], [wrong.end, (X0 + RIGHT) / 2, 740, .72], [T.wipe1 + .2, (X0 + RIGHT) / 2, 740, .73], [ru[0].t1, (X0 + RIGHT) / 2, 745, .74]] },
    { t0: T.row - .1, keys: [[T.row - .1, MF.cx, MF.cy + 40, MF.s], [T.wall, MF.cx, MF.cy + 50, MF.s]] },
    { t0: T.wall, keys: [[T.wall, MF.cx, MF.cy + 50, MF.s], [T.wall + 1.6, 2350, 900, .34], [T.DUR, 2350, 902, .338]] },
  ];
  const camAt = tt => {
    let i = 0; while (i + 1 < shots.length && tt >= shots[i + 1].t0) i++;
    const K = shots[i].keys; let k = 0; while (k + 1 < K.length - 1 && tt > K[k + 1][0]) k++;
    const a = K[k], b = K[Math.min(K.length - 1, k + 1)], u = b[0] > a[0] ? eio(clamp((tt - a[0]) / (b[0] - a[0]))) : 1;
    return { cx: lerp(a[1], b[1], u), cy: lerp(a[2], b[2], u), s: lerp(a[3], b[3], u), shot: i };
  };
  // every stroke is a chalk sound
  for (const st of S) {
    if (st.t1 <= 0 || st.t0 >= T.DUR) continue;
    const c = camAt((st.t0 + st.t1) / 2), p = st.at(st.len / 2), sx = (p[0] - c.cx) * c.s / W * 2;
    EV.push({ t: +st.t0.toFixed(3), type: 'chalk', d: +(st.t1 - st.t0).toFixed(3), len: Math.round(st.len * c.s), color: st.color, pan: +clamp(sx * .6, -.7, .7).toFixed(2), big: st.w > 12 ? 1 : 0 });
  }
  EV.sort((a, b) => a.t - b.t);
  return { S, TX, EV, SUBS: [], T, wet: null, wipe, slideX: () => 0, camAt, shots, DUR: T.DUR };
}
