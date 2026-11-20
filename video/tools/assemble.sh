#!/usr/bin/env bash
# Join the rendered parts, add the mixed soundtrack, and encode the deliverables into output/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p output
ls build/parts/p*.mp4 | sort -V | sed "s|^|file '$(pwd)/|; s|$|'|" > build/parts/concat.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i build/parts/concat.txt -c copy build/video_only.mp4
# 1080p master
ffmpeg -y -loglevel error -i build/video_only.mp4 -i build/mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 18 -tune stillimage -pix_fmt yuv420p -profile:v high -level 4.1 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -g 60 \
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
