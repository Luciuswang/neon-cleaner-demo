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

## 手机测试

部署到 GitHub Pages 后，用手机访问 Pages 地址即可。视频是 muted + playsinline，适合移动端自动播放。

## 项目结构

```text
docs/
  story-bible.md
  branch-map.md
  ai-shot-list.md
web/
  index.html
  styles.css
  script.js
  assets/
    neon-cleaner-bg-noaudio.mp4
    neon-cleaner-keyframe.png
```

## 注意

`source/video` 是本地素材目录，不提交到 GitHub。公开版本只包含已经去掉音轨的背景视频。

