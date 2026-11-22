"""Chalk foley (synthesized), wipe, knock, bell and a sparse marimba line → out/mix.wav. Times from events.json."""
import json, os, sys
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.environ.get('LIB', '/root/lemo-opuscar')
sys.path.insert(0, os.path.join(LIB, 'core', 'audio'))
import sfx
from sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, add
E = json.load(open(os.path.join(HERE, 'events.json'))); DUR, EV = E['dur'], E['ev']
rng = np.random.default_rng(3)
N = int((DUR + 1) * SR); fol = np.zeros((N, 2)); mus = np.zeros((N, 2))

def chalk(d, ln, orange):
    d = max(.04, d); tt = t_(d)
    grit = (rng.random(len(tt)) > .6) * rng.standard_normal(len(tt))
    x = bp(grit, 1800, 6500) * .7 + bp(noise(d), 900, 3000) * .35
    m = .55 + .45 * np.abs(np.sin(2 * np.pi * (14 + rng.random() * 10) * tt))
    e = np.minimum(1, tt / .008) * np.minimum(1, (d - tt) / .02)
    x = x * m * e
    if orange: x = lp(x, 3200)
    tap = hp(noise(.02), 1500) * env_exp(.02, .003)
    x[:len(tap)] += tap * 1.4
    return norm(x) * (.25 + .5 * min(1, ln / 260))

def felt(d):
    tt = t_(d); return norm(lp(noise(d), 900) * np.sin(np.pi * tt / d) ** 1.5) * .5

def knock():
    d = .12; tt = t_(d); return (np.sin(2 * np.pi * 210 * tt) * env_exp(d, .025) + bp(noise(d), 600, 2000) * env_exp(d, .01) * .5) * .7

def bell():
    d = 3.5; tt = t_(d)
    x = sum(a * np.sin(2 * np.pi * f * tt) * env_exp(d, tau) for f, a, tau in [(660, 1, 1.4), (1320, .4, .7), (1650, .3, .5), (2100, .15, .3)])
    return lp(x, 3000) * .25

def marimba(m, v=1., d=1.6):
    f = 440 * 2 ** ((m - 69) / 12); tt = t_(d)
    x = np.sin(2 * np.pi * f * tt) * env_exp(d, .5) + .3 * np.sin(2 * np.pi * f * 3.93 * tt) * env_exp(d, .06)
    x[:48] *= np.linspace(0, 1, 48); return x * v * .35

for e in EV:
    t, ty = e['t'], e['type']
    if ty == 'chalk': add(fol, chalk(e['d'], e['len'], e['color'] == 'orange'), t, .55, e['pan'])
    elif ty == 'wipe': add(fol, felt(e['d']), t, .8, .1)
    elif ty == 'tap': add(fol, knock(), t, .8)
    elif ty == 'bell': add(fol, bell(), t, .7, -.3)
# sparse marimba: a quiet phrase at the start, silence over the wrong answer, a warm lift after the right one
wipe_t = next(e['t'] for e in EV if e['type'] == 'wipe'); tap_t = next(e['t'] for e in EV if e['type'] == 'tap')
for i, m in enumerate([60, 64, 67, 72]): add(mus, marimba(m, .6), .2 + i * .6, 1, -.2)
for i, m in enumerate([67, 64]): add(mus, marimba(m, .5), 2.8 + i * .6, 1, .2)
for i, m in enumerate([60, 64, 67, 71, 74, 79]): add(mus, marimba(m, .6), tap_t + i * .3, 1, -.3 + i * .12)
for i, m in enumerate([72, 76, 79, 84]): add(mus, marimba(m, .45, 2.4), DUR - 3.2 + i * .5, 1, .2)
mix = fol + mus * .8
end = int(DUR * SR); mix = mix[:end]; fo = int(.8 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * .9
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24'); print('mix ok', len(mix) / SR)
