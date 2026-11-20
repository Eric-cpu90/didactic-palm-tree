#!/usr/bin/env bash
# Join the rendered parts, add the mixed soundtrack, and encode the deliverables into output/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p output
# p0fix.mp4 (if present) replaces the first 30 s of p0.mp4 (frames 0-899)
if [ -f build/parts/p0fix.mp4 ]; then
  VIN=(-i build/parts/p0fix.mp4 -i build/parts/p0.mp4 -i build/parts/p1.mp4 -i build/parts/p2.mp4 -i build/parts/p3.mp4)
  FC="[1:v]trim=start_frame=900,setpts=PTS-STARTPTS[b];[0:v][b][2:v][3:v][4:v]concat=n=5:v=1:a=0[v]"; NA=5
else
  VIN=(-i build/parts/p0.mp4 -i build/parts/p1.mp4 -i build/parts/p2.mp4 -i build/parts/p3.mp4)
  FC="[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v]"; NA=4
fi
# 1080p master
ffmpeg -y -loglevel error "${VIN[@]}" -i build/mix.wav -filter_complex "$FC" -map "[v]" -map ${NA}:a \
  -c:v libx264 -preset slow -crf 18 -tune stillimage -pix_fmt yuv420p -profile:v high -level 4.1 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -g 60 -r 30 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart \
  -metadata title="天下为公 —— 纪念孙中山先生诞辰一百六十周年" -metadata:s:a:0 language=chi \
  output/天下为公_纪念孙中山先生_1080p.mp4
# 720p copy for phones / messaging apps
ffmpeg -y -loglevel error -i output/天下为公_纪念孙中山先生_1080p.mp4 -vf scale=1280:720:flags=lanczos \
  -c:v libx264 -preset slow -crf 22 -tune stillimage -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart \
  output/天下为公_纪念孙中山先生_720p.mp4
cp build/subtitles.srt output/天下为公_字幕.srt
cp CREDITS.md output/
ls -la output
