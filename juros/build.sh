#!/bin/sh
set -e
LIB=${LIB:-/root/lemo-opuscar}; export LIB; HERE=$(cd "$(dirname "$0")" && pwd); cd "$LIB"
node core/render/events.mjs "$HERE"
"$LIB/.venv/bin/python" "$HERE/mix.py"
node core/render/readcheck.mjs "$HERE"
node core/render/video.mjs "$HERE" --fps 30 --workers 4 --out "$HERE/out/video.mp4"
if ! sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/juros.mp4" 30 1; then
  "$LIB/.venv/bin/python" "$HERE/tools_master.py" "$HERE/out/mix.wav" "$HERE/out/master.wav"
  ffmpeg -hide_banner -loglevel error -y -i "$HERE/out/video.mp4" -i "$HERE/out/master.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$HERE/juros.mp4"
fi
