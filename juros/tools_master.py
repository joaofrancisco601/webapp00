"""Master the mix to about -14 LUFS / -1 dBTP without ffmpeg's loudnorm (ffmpeg 6.x workaround).
Measures integrated loudness with ffmpeg's ebur128 filter, applies the gain, then a 4x-oversampled limiter."""
import re, subprocess, sys
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
from scipy.ndimage import maximum_filter1d, uniform_filter1d
src, dst = sys.argv[1], sys.argv[2]
def lufs(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1]); P = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1]); return I, P
x, sr = sf.read(src)
for it in range(3):
    I, _ = lufs(src if it == 0 else dst)
    x = x * 10 ** ((-14.0 - I) / 20)
    # true-peak limiter at -1.2 dBTP (4x oversampled detection)
    ceil = 10 ** (-1.2 / 20)
    up = np.stack([resample_poly(x[:, c], 4, 1) for c in range(2)], 1)
    pk = maximum_filter1d(np.abs(up).max(1), size=4 * int(.005 * sr) * 2 + 1)
    gain = uniform_filter1d(np.minimum(1, ceil / np.maximum(pk, 1e-9)), size=4 * int(.005 * sr))[::4][:len(x)]
    x = x * gain[:, None]
    sf.write(dst, x.astype(np.float32), sr, subtype='PCM_24')
I, P = lufs(dst); print(f'master: {I:.1f} LUFS, true peak {P:.1f} dBFS')
