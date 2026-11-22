"""Score + foley + ambience for "Como um prédio fica de pé" → out/mix.wav (48 kHz stereo).
Everything is synthesized here (no samples). Times come from events.json (exported from the page) and the
same 100 bpm grid as timeline.js."""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB', '/root/lemo-opuscar')
sys.path.insert(0, os.path.join(LIB, 'core', 'audio'))
import sfx
from sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, add, brown

rng = np.random.default_rng(7)
E = json.load(open(os.path.join(HERE, 'events.json')))
DUR = E['dur']; EV = E['ev']
BEAT = 0.6
bt = lambda n: n * BEAT
N = int((DUR + 1.5) * SR)
music = np.zeros((N, 2)); fol = np.zeros((N, 2)); amb = np.zeros((N, 2))

def mtof(m): return 440 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def n(s):  # 'E5', 'F#4'
    k = NOTE[s[0]] + (1 if '#' in s else 0); o = int(s[-1]); return 12 * (o + 1) + k

# ---------- instruments ----------
def marimba(m, v=1., d=1.2):
    f = mtof(m); tt = t_(d)
    x = (np.sin(2 * np.pi * f * tt) * env_exp(d, .45 if f < 400 else .3)
         + .35 * np.sin(2 * np.pi * f * 3.93 * tt) * env_exp(d, .06)
         + .12 * np.sin(2 * np.pi * f * 9.2 * tt) * env_exp(d, .02))
    x += hp(noise(d), 1500) * env_exp(d, .002) * .15
    x[:48] *= np.linspace(0, 1, 48)
    return x * v * .5

def glock(m, v=1., d=2.4):
    f = mtof(m); tt = t_(d)
    x = (np.sin(2 * np.pi * f * tt) * env_exp(d, .9) + .4 * np.sin(2 * np.pi * f * 2.76 * tt) * env_exp(d, .35)
         + .18 * np.sin(2 * np.pi * f * 5.4 * tt) * env_exp(d, .12))
    x[:24] *= np.linspace(0, 1, 24)
    return x * v * .32

def kalimba(m, v=1., d=1.6):
    f = mtof(m); tt = t_(d)
    x = np.sin(2 * np.pi * f * tt) * env_exp(d, .5) + .25 * np.sin(2 * np.pi * f * 5.95 * tt) * env_exp(d, .05)
    x[:36] *= np.linspace(0, 1, 36)
    return x * v * .4

def bass(m, v=1., d=1.0):
    f = mtof(m); tt = t_(d)
    x = np.sin(2 * np.pi * f * tt) + .35 * np.sin(4 * np.pi * f * tt) + .18 * np.sin(6 * np.pi * f * tt)
    e = np.minimum(1, tt / .01) * env_exp(d, d * .45) * np.minimum(1, (d - tt) / .05)
    return lp(x * e, 900) * v * .32

def woodblock(v=1., p=1.):
    d = .09; tt = t_(d)
    x = np.sin(2 * np.pi * 820 * p * tt) * env_exp(d, .018) + .5 * bp(noise(d), 1200 * p, 2600 * p) * env_exp(d, .006)
    return x * v * .35

def shaker(v=1.):
    d = .07; return hp(noise(d), 5000) * np.sin(np.pi * t_(d) / d) ** 2 * v * .07

def kick(v=1.):
    d = .4; tt = t_(d); f = 52 + 70 * np.exp(-tt / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .12) * v * .6

def pad(ms, d, v=1.):
    tt = t_(d); x = np.zeros_like(tt)
    for m in ms:
        f = mtof(m)
        for det in (-.004, .004):
            x += 2 * ((tt * f * (1 + det)) % 1) - 1
    x = lp(x, 1100) / (2 * len(ms))
    e = np.minimum(1, tt / .9) * np.minimum(1, (d - tt) / 1.0)
    return x * e * v * .5

def blip(m, v=1.):  # clean electronic pulse
    d = .14; f = mtof(m); tt = t_(d)
    x = np.sign(np.sin(2 * np.pi * f * tt)) * .5 + np.sin(2 * np.pi * f * tt) * .5
    return lp(x, 2500) * env_exp(d, .035) * v * .18

def put(buf, x, at, g=1., pan=0.):
    if at < 0: return
    add(buf, x, at, g, pan)

# ---------- harmony (4 beats per chord, from t = 0) ----------
PROG = [['C3', 'C4', 'E4', 'G4'], ['A2', 'A3', 'C4', 'E4'], ['F2', 'F3', 'A3', 'C4'], ['G2', 'G3', 'B3', 'D4']]
def chord(beat): return [n(s) for s in PROG[int(beat // 4) % 4]]

SEC = {'titulo': 0, 'terreno': 6, 'fundacao': 14, 'estrutura': 26, 'nucleo': 42, 'instalacoes': 52, 'fachada': 64, 'peso': 72, 'final': 84}

# S0 title: the "weight" motif, descending
for i, s in enumerate(['E5', 'D5', 'C5', 'G4']):
    put(music, marimba(n(s), .9, 1.6), bt(i), 1, -.2 + .1 * i)
put(music, kalimba(n('C4'), .5, 2.5), bt(0), 1, .3)
put(music, kalimba(n('G4'), .4, 2.5), bt(2), 1, .3)

# S1 ground: bass + shaker + sparse marimba
for bb in range(6, 14):
    c = chord(bb)
    if bb % 2 == 0: put(music, bass(c[0], .9, bt(2) * .95), bt(bb))
    for h in range(2): put(music, shaker(.8 if h == 0 else .5), bt(bb + h * .5), 1, .4)
    if bb % 2 == 1: put(music, marimba(c[2] + 12, .45), bt(bb + .5), 1, -.3)

# S2 foundation: woodblock on every beat, marimba eighths, bass
for bb in range(14, 26):
    c = chord(bb)
    put(music, woodblock(.9 if bb % 2 == 0 else .6), bt(bb), 1, .25)
    if bb % 2 == 0: put(music, bass(c[0], 1, bt(2) * .9), bt(bb))
    for h in range(2): put(music, marimba(c[1 + (bb * 2 + h) % 3] + 12, .38 + .1 * h, .8), bt(bb + h * .5), 1, -.35)
    put(music, shaker(.5), bt(bb + .5), 1, .4)

# S3 structure: quarter-note marimba → eighths; bass pulses; shaker sixteenths later
for bb in range(26, 42):
    c = chord(bb); dense = bb >= 34
    sub = 4 if dense else 2
    for h in range(sub):
        tone = c[1 + (bb * sub + h) % 3] + 12 + (12 if dense and h % 2 else 0)
        put(music, marimba(tone, .42 if h else .55, .7), bt(bb + h / sub), 1, -.3 + .15 * (h % 2))
    put(music, bass(c[0], 1, bt(.5) * .9), bt(bb)); put(music, bass(c[0] + 12 if dense else c[0], .7, bt(.5) * .8), bt(bb + .5))
    if bb % 2 == 1: put(music, kick(.55), bt(bb))
    for h in range(4 if dense else 2): put(music, shaker(.55), bt(bb + h / (4 if dense else 2)), 1, .45)
put(music, kick(.9), bt(42) - .01); put(music, glock(n('C6'), .8, 3), bt(40))

# S4 core: pad + long bass, marimba out
put(music, pad([n('A3'), n('C4'), n('E4')], bt(5) + 1.0, .9), bt(42))
put(music, pad([n('F3'), n('A3'), n('C4')], bt(5) + 1.0, .9), bt(47))
for bb in (42, 46, 50): put(music, bass(chord(bb)[0], .8, bt(4)), bt(bb))
put(music, kalimba(n('E5'), .5), bt(44), 1, .3); put(music, kalimba(n('C5'), .5), bt(48), 1, .3)

# S5 installations: clean electronic pulse in sixteenths, bass, light kick
for bb in range(52, 64):
    c = chord(bb)
    for h in range(4): put(music, blip(c[1 + (h + bb) % 3] + 12, .9 if h == 0 else .6), bt(bb + h / 4), 1, -.4 + .27 * h)
    if bb % 2 == 0: put(music, bass(c[0], .9, bt(2) * .9), bt(bb)); put(music, kick(.5), bt(bb))
    put(music, shaker(.4), bt(bb + .5), 1, .4)

# S6 facade: light marimba eighths, bass, a bright lift
for bb in range(64, 72):
    c = chord(bb)
    for h in range(2): put(music, marimba(c[1 + (bb * 2 + h) % 3] + 24, .35, .9), bt(bb + h / 2), 1, .3 - .6 * h)
    if bb % 2 == 0: put(music, bass(c[0], .8, bt(2) * .9), bt(bb))

# S7 the turn: silence, then the motif slowly, one note per station (times from the page)
st = [e['t'] for e in EV if e['type'] == 'station']
for i, (tt_, s) in enumerate(zip(st, ['E5', 'D5', 'C5', 'G4', 'C4'])):
    put(music, marimba(n(s), .9, 2.5), tt_, 1, 0); put(music, glock(n(s) + 12, .45, 2.5), tt_, 1, .2)
    put(music, bass(n(s) - 24, .6, 1.4), tt_)
put(music, pad([n('C2') + 12, n('G3')], 7.0, .7), bt(74.3))

# S8 final: open chord arpeggio, one note per beat, then a held chord
fin = ['C4', 'G4', 'D5', 'E5', 'G5', 'C6', 'E6']
for i, s in enumerate(fin): put(music, kalimba(n(s), .6, 2.6), bt(84 + i * .75), 1, -.5 + i * .16)
put(music, pad([n('C3'), n('G3'), n('E4'), n('D4')], 6.2, .8), bt(85))
put(music, bass(n('C2'), .8, 4.0), bt(84))
put(music, glock(n('G5'), .5, 3), bt(84 + 6)); put(music, glock(n('C6'), .5, 3.4), bt(84 + 7.5))

# ---------- foley ----------
def clang(v=1., p=1.):  # pile driver: inharmonic steel + thud
    d = .9; tt = t_(d)
    x = sum(a * np.sin(2 * np.pi * f * p * tt + rng.random() * 6) * env_exp(d, tau) for f, a, tau in [(310, .7, .25), (747, .5, .18), (1290, .35, .12), (2210, .2, .07)])
    return x * .6 * v

def pile_hit(v=1.):
    th = sfx.thump(1, 60); c = clang(1, .9 + rng.random() * .2)
    out = np.zeros(max(len(th), len(c))); out[:len(th)] += th * .9; out[:len(c)] += c * .5
    return out * v

def glass(v=1., p=1.):
    d = 1.0; tt = t_(d)
    x = sum(a * np.sin(2 * np.pi * f * p * tt) * env_exp(d, tau) for f, a, tau in [(2400, 1, .25), (3610, .6, .15), (5230, .4, .08), (1580, .3, .3)])
    return (x + hp(noise(d), 4000) * env_exp(d, .004) * .4) * v * .25

def tear(d=.35, v=1.):
    x = bp(noise(d), 1500, 6000) * (np.abs(np.sin(2 * np.pi * 37 * t_(d))) ** 4) * np.sin(np.pi * t_(d) / d)
    return norm(x) * v * .35

def pour(d, v=1.):
    return norm(lp(brown(d), 380) + bp(noise(d), 200, 900) * .15) * np.sin(np.pi * t_(d) / d) ** .5 * v * .35

def grains(d, v=1.):
    x = bp(noise(d), 1500, 5000) * (rng.random(int(round(d * SR))) > .97) * 3 + lp(brown(d), 300) * .4
    return norm(x) * np.sin(np.pi * t_(d) / d) * v * .28

def windbed(d, v=1.):
    tt = t_(d); m = .6 + .4 * np.sin(2 * np.pi * .23 * tt) * np.sin(2 * np.pi * .07 * tt + 1)
    return norm(bp(noise(d), 250, 1400)) * m * np.minimum(1, tt / .8) * np.minimum(1, (d - tt) / .8) * v * .3

def water(d, v=1.):
    tt = t_(d); x = np.zeros_like(tt)
    for k in range(int(d * 14)):
        s = rng.random() * (d - .1); f = 500 + rng.random() * 900; l = .05
        i0 = int(s * SR); seg_ = np.sin(2 * np.pi * np.cumsum(np.linspace(f, f * 1.6, int(l * SR))) / SR) * np.hanning(int(l * SR))
        x[i0:i0 + len(seg_)] += seg_[:len(x) - i0]
    return (x * .3 + bp(noise(d), 600, 2400) * .25) * np.minimum(1, tt / .5) * np.minimum(1, (d - tt) / .5) * v * .35

def boom(v=1.):
    d = 2.6; tt = t_(d)
    return (np.sin(2 * np.pi * 42 * tt * (1 - .1 * tt)) * env_exp(d, .7) + lp(noise(d), 160) * env_exp(d, .25) * .6) * v * .9

ev_t = lambda ty: [e['t'] for e in EV if e['type'] == ty]
for e in EV:
    t, ty = e['t'], e['type']
    if ty == 'title': put(fol, sfx.whoosh(.5, .3), t)
    elif ty == 'arrowLand': put(fol, sfx.thump(1, 55), t, .9); put(fol, grains(.6, .6), t)
    elif ty == 'whoosh': put(fol, sfx.whoosh(.6, .35), t - .2)
    elif ty == 'pile': put(fol, pile_hit(.9), t, .8, .3)
    elif ty == 'blocks': put(fol, sfx.clack(.6, .8), t, .7); put(fol, sfx.clack(.7, .6), t + .12, .6, .2)
    elif ty == 'craneUp': put(fol, sfx.creak(.6), t + .3, .5, -.4); put(fol, sfx.creak(.5), t + .8, .4, -.4)
    elif ty == 'columns': put(fol, sfx.click(.8, .5), t, .35, .2)
    elif ty == 'slab': put(fol, sfx.clack(.55, .8), t, .55, .1); put(fol, sfx.thump(.5, 80), t, .35)
    elif ty == 'roof': put(fol, sfx.clack(.5, .9), t, .6)
    elif ty == 'cut': put(fol, tear(.4, 1), t, .8)
    elif ty in ('slide', 'slideBack'): put(fol, sfx.whoosh(.55, .45), t, .6, .3)
    elif ty == 'inset': put(fol, sfx.ding(.35), t + .25, .4, .5)
    elif ty == 'glass': put(fol, glass(.9, 1 + .05 * e.get('i', 0)), t, .7, .35)
    elif ty == 'tank': put(fol, sfx.thump(.9, 70), t, .7); put(fol, water(.8, .7), t + .05)
    elif ty == 'craneDown': put(fol, sfx.whoosh(1.2, .35), t, .5, -.4)
    elif ty == 'station': put(fol, sfx.thump(.5, 65), t, .45)
    elif ty == 'rock': put(fol, boom(1), t, 1)
    elif ty == 'pull': put(fol, sfx.whoosh(1.4, .35), t, .5)
    elif ty == 'legend': put(fol, sfx.ding(.3), t, .35, -.4)

def span(a, b): return ev_t(a)[0], ev_t(b)[0]
d0, d1 = span('digStart', 'digEnd'); put(fol, grains(d1 - d0, 1), d0, .9, .3)
p0, p1 = span('pourStart', 'pourEnd'); put(fol, pour(p1 - p0 + .4, 1), p0, .9)
w0, w1 = span('windStart', 'windEnd'); put(amb, windbed(w1 - w0 + 1, 1.6), w0, 1, -.3)
r0 = ev_t('risers')[0]; r1 = ev_t('slideBack')[0]; put(amb, water(r1 - r0, .8), r0, .8, .2)

# ambience: light wind all through, site hum in the build, city hum at the end
put(amb, windbed(DUR + 1, .6), 0, 1, .2)
h0, h1 = bt(SEC['fundacao']), bt(SEC['nucleo'])
put(amb, norm(lp(brown(h1 - h0), 140)) * np.minimum(1, t_(h1 - h0) / 1) * np.minimum(1, (h1 - h0 - t_(h1 - h0)) / 1) * .12, h0)
c0 = bt(SEC['fachada']); put(amb, norm(bp(brown(DUR - c0 + 1), 90, 600)) * .05 * np.minimum(1, t_(DUR - c0 + 1) / 1.5), c0)

# ---------- mix ----------
mix = music * 1.0 + fol * 0.9 + amb * 0.8
# the silence before the turn: digital zero (short fades)
s0, s1 = ev_t('silence0')[0], ev_t('silence1')[0]
i0, i1 = int(s0 * SR), int(s1 * SR); f = int(.04 * SR)
mix[i0 - f:i0] *= np.linspace(1, 0, f)[:, None]; mix[i0:i1] = 0
# fade out the very end
end = int(DUR * SR); fo = int(1.2 * SR)
mix[end - fo:end] *= np.linspace(1, 0, fo)[:, None] ** 1.5; mix = mix[:end]
# gentle bus compression + limiter, normalised to a peak; loudness is set by the muxer
for ch in range(2): mix[:, ch] = sfx.limit(mix[:, ch] / (np.abs(mix).max() + 1e-9) * .9, .9)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
import soundfile as sf
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
# low-end balance report
from scipy.signal import welch
fr, P = welch(mix.mean(1), SR, nperseg=8192)
lo = P[(fr >= 20) & (fr < 120)].sum(); rest = P[(fr >= 120) & (fr < 16000)].sum()
print(f'mix.wav  {len(mix) / SR:.2f} s   energy 20-120 Hz vs rest {10 * np.log10(lo / rest):.1f} dB')
