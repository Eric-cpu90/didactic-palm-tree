#!/usr/bin/env bash
# Downloads fonts (SIL OFL), Natural Earth land polygons (public domain) and the
# offline TTS model (Kokoro v1.1-zh via sherpa-onnx, Apache-2.0) into build/assets.
set -euo pipefail
cd "$(dirname "$0")"
A=build/assets; mkdir -p $A/fonts
get() { [ -s "$2" ] || curl -sSL --retry 3 -o "$2" "$1"; }
NOTO=https://raw.githubusercontent.com/notofonts/noto-cjk/main
get $NOTO/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf $A/fonts/NotoSansSC-Regular.otf
get $NOTO/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf    $A/fonts/NotoSansSC-Bold.otf
get $NOTO/Sans/SubsetOTF/SC/NotoSansSC-Black.otf   $A/fonts/NotoSansSC-Black.otf
get $NOTO/Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf  $A/fonts/NotoSerifSC-Bold.otf
get $NOTO/Serif/SubsetOTF/SC/NotoSerifSC-Black.otf $A/fonts/NotoSerifSC-Black.otf
get https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf $A/fonts/MaShanZheng-Regular.ttf
get https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson $A/ne_50m_land.geojson
if [ ! -d $A/kokoro-int8-multi-lang-v1_1 ]; then
  curl -sSL --retry 3 https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-multi-lang-v1_1.tar.bz2 | tar xj -C $A
fi
echo "assets ready"
