#!/usr/bin/env bash
# End-to-end build: assets -> narration (offline TTS) -> cues -> soundtrack -> frames -> final MP4.
set -euo pipefail
cd "$(dirname "$0")"
JOBS=${JOBS:-4}
./fetch_assets.sh
python3 -m pip install -q sherpa-onnx soundfile numpy scipy
(cd render && npm install --silent)
python3 tts.py build/assets/kokoro-int8-multi-lang-v1_1     # build/tts/*.wav + build/timeline.json
node render/render.js --prep                                 # procedural Earth/Moon textures
node render/render.js --cues                                 # build/cues.json (sound-effect cues)
python3 audio.py                                             # build/audio.wav
rm -f build/parts/*.mp4
for i in $(seq 0 $((JOBS - 1))); do node render/render.js --part "$i" --of "$JOBS" --threads 1 --crf 24 --preset slow & done
wait
: > build/parts/list.txt
for i in $(seq 0 $((JOBS - 1))); do echo "file 'part$i.mp4'" >> build/parts/list.txt; done
mkdir -p output
ffmpeg -y -loglevel error -f concat -safe 0 -i build/parts/list.txt -i build/audio.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart output/china-moon-landing.mp4
python3 subtitles.py
echo "done: output/china-moon-landing.mp4"
