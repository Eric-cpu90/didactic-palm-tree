# 天下为公 —— 纪念孙中山先生诞辰一百六十周年

约 10 分钟的纪念短片（1920×1080，30 fps），中文旁白、硬字幕、原创配乐。

**结构**：开篇题词「世界潮流，浩浩荡荡」→ 片头 → 八章（翠亨少年 · 上医医国 · 三民主义 · 屡败屡战 · 创立民国 · 捍卫共和 · 黄埔建军 · 抱病北上）→ 终章「天下为公」→ 片尾。

成片不入库（体积大），由下面的流水线从源文件生成到 `output/`。

## 目录

| 路径 | 内容 |
|---|---|
| `narration.txt` | 解说词（格式说明见文件头） |
| `lexicon-custom.txt` | 语音合成的读音修正（多音字、变调） |
| `shots.json` | 分镜：每个镜头的图片、出现时机（锚定到解说句子）、推拉摇移、年份与图注、文字/地图叠加层 |
| `images.json` | 用到的图片及调色方式 |
| `credits.html` / `CREDITS.md` | 片尾字幕 / 全部图片的作者、许可与出处 |
| `web/` | 画面引擎（HTML/Canvas，逐帧确定性渲染）、样式与子集化字体 |
| `assets/` | 处理后的图片、地图点阵（由 `tools/images.py`、`tools/maps.py` 生成） |
| `tools/` | 流水线脚本 |

## 流水线

```bash
# 依赖：python3 (sherpa-onnx soundfile numpy librosa pypinyin pillow mido matplotlib fonttools)、
#       node + playwright（Chromium）、ffmpeg、fluidsynth + fluid-soundfont-gm
export SYS_MODELS=/path/to/models          # 含 kokoro-multi-lang-v1_1/（可选 SenseVoice 用于读音核验）
SYS_SPEED=1.03 python3 tools/tts.py        # 1. 旁白合成（逐单元缓存，并用语音识别核对读音）
python3 tools/timeline.py                  # 2. 时间轴：旁白、字幕、章节卡、镜头对齐
python3 tools/music.py                     # 3. 按时间轴作曲并渲染配乐
python3 tools/mix.py                       # 4. 混音（旁白处自动压低音乐）、响度 -16 LUFS
python3 tools/preview.py                   # （可选）每个镜头一张预览图 → build/sheets/
node tools/render.js --from 0 --to 152.4 --out build/parts/p0.mp4   # 5. 逐帧渲染（可分段并行）
tools/assemble.sh                          # 6. 拼接、封装 → output/
```

素材准备（一次性）：`tools/images.py <下载目录>` 处理图片；`tools/maps.py <world-atlas 目录>` 生成地图点阵；`tools/fonts.py <字体目录>` 子集化字体；`tools/credits.py` 生成署名清单与 SRT 字幕。
