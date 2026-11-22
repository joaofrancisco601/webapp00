#!/bin/sh
# Rebuild the film from scratch: sh build.sh
set -e
LIB=${LIB:-/root/lemo-opuscar}
export LIB
HERE=$(cd "$(dirname "$0")" && pwd)
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }
[ -s "$HERE/fonts/Jost.ttf" ] || curl -fsSL -g -o "$HERE/fonts/Jost.ttf" "https://raw.githubusercontent.com/google/fonts/86aced91de05cd4f96a06838124cca45be337b2b/ofl/jost/Jost[wght].ttf"
cd "$LIB"
node core/render/events.mjs "$HERE"                                   # picture events → events.json
node core/render/readcheck.mjs "$HERE"                                # on-screen text reading time
"$LIB/.venv/bin/python" "$HERE/mix.py"                                # score + foley + ambience → out/mix.wav
node core/render/video.mjs "$HERE" --fps 24 --workers 4 --out "$HERE/out/video.mp4"
if sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/predio.mp4" 24 0; then :; else
  # ffmpeg 6.x fallback: master in Python (-14 LUFS, -1.2 dBTP), mux without loudnorm
  "$LIB/.venv/bin/python" "$HERE/tools_master.py" "$HERE/out/mix.wav" "$HERE/out/master.wav"
  ffmpeg -hide_banner -loglevel error -y -i "$HERE/out/video.mp4" -i "$HERE/out/master.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$HERE/predio.mp4"
fi
node core/render/still.mjs "$HERE" 56.5 --q nosub=1 --out "$HERE/out" --prefix po_ >/dev/null && cp "$HERE/out/po_56.5.jpg" "$HERE/poster.jpg"
echo "done: $HERE/predio.mp4"
