// Single source of truth: tempo grid, sections, hit points, captions.
export const BPM = 100, BEAT = 60 / BPM; // 0.6 s
export const b = n => +(n * BEAT).toFixed(4);            // beat → seconds
export const DUR = 57.0;

export const SECS = [
  { id: 'titulo', t: b(0), beats: 6 },
  { id: 'terreno', t: b(6), beats: 8 },
  { id: 'fundacao', t: b(14), beats: 12 },
  { id: 'estrutura', t: b(26), beats: 16 },
  { id: 'nucleo', t: b(42), beats: 10 },
  { id: 'instalacoes', t: b(52), beats: 12 },
  { id: 'fachada', t: b(64), beats: 8 },
  { id: 'peso', t: b(72), beats: 12 },
  { id: 'final', t: b(84), beats: 11 },
];
export const S = Object.fromEntries(SECS.map(s => [s.id, s.t]));

// Hit points (seconds)
export const T = {
  arrowLand: b(4),                       // the load arrow hits the empty ground
  dig0: b(7), dig1: b(11),               // excavation
  piles: [0, 1, 2, 3, 4, 5, 6, 7].map(i => b(15 + i)),   // one pile per beat
  blocks: b(23), slabPour0: b(24), slabPour1: b(25.5),
  // floors: 4 on quarter notes (2 beats), then 6 on single beats
  floors: [...[0, 1, 2, 3].map(i => b(26 + i * 2)), ...[0, 1, 2, 3, 4, 5].map(i => b(34 + i))],
  roof: b(40),
  cut: b(42.5),                          // cut line starts on the slabs
  wind: b(45),
  insetCore: b(46),
  risers: b(52),
  insetPipes: b(56),
  restore: b(64),                        // the cut quadrant slides back
  glass: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => b(64.5 + i * 0.5)),
  tank: b(70),
  silence0: b(72), silence1: b(74),
  loadStart: b(74.3), loadEnd: b(81.5),
  rock: b(81.5),
  pull: b(84),
};

export const CAPS = [
  { t0: 3.9, t1: 8.1, text: 'Embaixo da terra fofa existe rocha firme.' },
  { t0: 8.7, t1: 15.3, text: 'Estacas de concreto descem até a rocha: é nela que o prédio se apoia.' },
  { t0: 15.9, t1: 20.4, text: 'Pilares, vigas e lajes formam o esqueleto.' },
  { t0: 20.7, t1: 25.0, text: 'Andar por andar, a estrutura sobe.' },
  { t0: 25.5, t1: 31.0, text: 'O núcleo guarda elevador e escadas e segura o vento.' },
  { t0: 31.5, t1: 38.1, text: 'Água, esgoto e energia sobem por dentro, até cada andar.' },
  { t0: 38.7, t1: 43.0, text: 'Por fim, a fachada fecha o prédio.' },
  { t0: 44.6, t1: 50.3, text: 'Todo o peso desce: laje, viga, pilar, estaca… até a rocha.' },
  { t0: 50.9, t1: 56.7, text: 'Cada parte passa o peso adiante. Por isso o prédio fica de pé.' },
];
