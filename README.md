# 霓虹清道夫 Neon Cleaner Demo

一个“电影观看 + 关键片段接管 + 数值分支结局”的交互式视频游戏原型。

## 当前版本

- 背景使用无声音 AI 视频：`web/assets/neon-cleaner-bg-noaudio.mp4`
- 开场影片节点
- 追车接管玩法
- 追车结果分支
- Boss 接管玩法
- 三个结局

## 本地运行

直接打开：

```text
web/index.html
```

或用本地服务器：

```powershell
cd web
python -m http.server 5177
```

然后打开：

```text
http://127.0.0.1:5177/
```

也可以直接用仓库根目录的一键脚本：

```powershell
.\start_local_demo.ps1
```

停止本地服务：

```powershell
.\stop_local_demo.ps1
```

## 手机测试

部署到 GitHub Pages 后，用手机访问 Pages 地址即可。视频是 muted + playsinline，适合移动端自动播放。

线上地址：

```text
https://luciuswang.github.io/neon-cleaner-demo/
```

## 明天继续

交接说明在：

```text
docs/handoff.md
```

新环境里让 Codex 先阅读 `README.md` 和 `docs/handoff.md`，就可以从当前状态继续。

## 3D 接管实验

主线开场 A0 现在会衔接到 World Labs / Marble 3D 接管页：

```text
web/world-prototype.html?from=A0&handoff=1&world=seamless&perf=balanced&camera=first
```

本地访问：

```text
http://127.0.0.1:5177/world-prototype.html?from=A0&handoff=1&world=seamless&perf=balanced&camera=first
```

准备说明：

```text
docs/marble-mvp-experiment.md
tools/worldlabs/README.md
```

当前无缝接管 Marble 世界资产：

```text
web/worlds/a0-seamless-takeover-500k.spz
web/worlds/a0-seamless-takeover-collider.glb
web/worlds/a0-seamless-takeover-world.json
```

旧版 Marble 世界资产仍保留作为 fallback：

```text
web/worlds/a0-war-signal-500k.spz
web/worlds/a0-war-signal-collider.glb
```

如果还没有 `.spz`，实验页会先显示本地低模战后旧金山代理场景，避免把示例资产误认为正式效果。

## Seedance 生成

Seedance 2.0 I2V 脚本在：

```text
tools/seedance/generate_a0_i2v.py
```

需要先设置火山方舟 Ark API Key：

```bash
export ARK_API_KEY="..."
python tools/seedance/generate_a0_i2v.py
```

当前提交的可测试版本仍使用已生成并验证过的 Sulphur2 A0 视频；拿到 `ARK_API_KEY` 后可用 Seedance 输出替换为 `web/assets/video/A0-S01-seedance-web.mp4`。

## 项目结构

```text
docs/
  story-bible.md
  branch-map.md
  ai-shot-list.md
  handoff.md
  marble-mvp-experiment.md
tools/
  worldlabs/
web/
  index.html
  styles.css
  script.js
  world-prototype.html
  assets/
    neon-cleaner-bg-noaudio.mp4
    neon-cleaner-keyframe.png
  worlds/
```

## 注意

`source/video` 是本地素材目录，不提交到 GitHub。公开版本只包含已经去掉音轨的背景视频。
