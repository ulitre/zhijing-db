# 知径 DB 路演 Demo 视频

面向投资人路演的产品演示片，约 3 分 47 秒，1920x1080 / 30fps / H.264。

## 成片

- `out/zhijing-db-demo.mp4` 成片，已烧录中文字幕，48kHz 立体声
- `out/zhijing-db-demo.srt` 外挂字幕，42 条，便于二次剪辑
- `SCRIPT.md` 分镜脚本、逐场旁白与制作说明
- `narration.json` 逐句旁白文本，可直接改词

## 结构

```
demo-video/
  out/                  成片与外挂字幕
  clips/                11 段原始录屏（未加字幕）
  frames/               每段录屏的原始帧与时间戳
  audio/                逐句微软神经语音 mp3 与 timing.json
  stage/                片头、痛点、片尾的 HTML 动效页
  build/                中间产物：标准化片段、拼接视频、ASS、混音 wav
  recorder.mjs          Playwright + CDP screencast 录屏内核
  scenes.mjs            应用内 8 个场景的自动化脚本
  scenes-stage.mjs      片头、痛点、片尾的录屏脚本
  tts.py                edge-tts 旁白合成与时长测量
  build_assets.py       字幕 ASS / SRT 与旁白混音
  assemble.mjs          标准化、拼接、烧字幕、混音、输出
  serve.mjs             支持干净 URL 的静态服务器
```

## 重新生成

只改旁白或字幕：

```bash
cd demo-video
python tts.py
SKIP_NORMALIZE=1 node assemble.mjs
```

只改视觉或重新录制：

```bash
# 1. 启动录制专用 API（干净数据）
cd apps/api
PORT=8790 DEEPSEEK_MODE=mock DATABASE_URL= pnpm exec tsx src/server.ts

# 2. 指向 8790 导出静态站，并把 bundle 中的 8787 替换为 8790
cd apps/client
EXPO_PUBLIC_API_URL=http://localhost:8790 pnpm exec expo export --platform web --output-dir dist-video

# 3. 起静态服务器
cd ../../demo-video
node serve.mjs

# 4. 录屏并合成
node scenes.mjs
node scenes-stage.mjs
node assemble.mjs
```

## 配音

- 默认音色：`zh-CN-XiaoxiaoNeural`（晓晓，女声），语速 `+6%`
- 改音色：编辑 `narration.json` 的 `voice`，例如 `zh-CN-YunxiNeural`，再运行 `python tts.py`
- 逐句音频在 `audio/`，改单句只需删除对应 mp3 后重跑

## 录制要点

- 视口 1920x1080，deviceScaleFactor 1，Chrome channel
- 自定义光标与点击涟漪通过 init script 注入
- 使用 CDP screencast 抓帧，按时间戳转 VFR 后统一到 30fps
- 录制数据来自 8790 的 `deterministic-mock`，SQL 沙箱为真实 sql.js 执行

## 口径说明

- 12 个 Agent 是同一 LangGraph 工作流中的角色节点，不是 12 个独立模型
- ReviewAgent 是打分与打回的工作流节点，不做独立事实核验
- 片中「65 分打回、重构、94 分终审」由 `forceReviewReject` 演示开关触发，用于稳定展示闭环
- 演示数据为虚构课程数据，SQL 沙箱与业务库完全隔离
