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

第一版 World Labs / Marble 接管实验页：

```text
web/world-prototype.html
```

本地访问：

```text
http://127.0.0.1:5177/world-prototype.html
```

准备说明：

```text
docs/marble-mvp-experiment.md
tools/worldlabs/README.md
```

真实 Marble 世界资产放这里：

```text
web/worlds/a0-war-signal-500k.spz
web/worlds/a0-war-signal-collider.glb
```

如果还没有 `.spz`，实验页会先使用公开 SparkJS 示例资产验证网页渲染链路。

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
