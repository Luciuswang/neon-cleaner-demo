# 霓虹清道夫 / Neon Cleaner 项目评估（2026-06-09）

## 当前整体状态

项目已经是一个可以在浏览器中测试的交互式电影游戏原型：

- A0 电影开场：使用本地生成的 Sulphur2/LTX 视频片段作为开场视觉。
- 3D 接管段：`web/world-prototype.html` 已经具备可操作的 Three.js / SparkJS 3D 追车原型。
- 主线分支：C1/C2/C3、A2、I2、E1/E2/E3 的文字与数值分支已经存在。
- 线上/本地部署方式简单：静态网页即可运行，适合 GitHub Pages。

## 本轮评估结论

### 优点

1. **核心玩法方向清晰**
   - 电影段负责叙事和气氛。
   - 接管段负责玩家输入和分支结果。
   - 结果回写主线，符合“互动 AI 电影游戏”的原型方向。

2. **Web 技术栈轻量**
   - 无构建步骤。
   - 本地 `python -m http.server` 即可运行。
   - GitHub Pages 可直接发布。

3. **3D 世界已有可用资产通道**
   - 优先加载 `web/worlds/a0-war-signal-500k.spz`。
   - 如资产不可用，可退回程序化低模战后旧金山代理场景。

### 主要问题

1. **真实视频资源仍需要更高质量模型产出**
   - Sulphur2 v2 比手工特效更自然，但仍是低分辨率、低帧率方向验证。
   - Seedance/Kling 这类商业 I2V 更适合作为最终电影段资产。

2. **Seedance 当前未能执行**
   - 本机 Hermes 环境没有配置 `ARK_API_KEY`。
   - 因此本轮不能真实调用 Seedance API 生成新资源。
   - 不能用伪造文件替代真实生成结果。

3. **3D 世界与主线之前是分离入口**
   - 原来 `3D 接管测试` 只是单独链接。
   - 本轮已改成 A0 电影段 → 3D 接管 → C1/C2/C3 主线分支的闭环。

## 本轮完成的衔接

### 主线入口

`web/script.js` 中 A0 节点现在不再直接进入 2D 追车，而是进入：

```text
web/world-prototype.html?from=film&return=1&perf=balanced&camera=first
```

A0 按钮文案改为：

```text
进入 3D 接管
```

### 3D 回写结果

`web/world-prototype.js` 根据 3D 接管表现计算：

- `C1 / Clean Pursuit`
- `C2 / Damaged Pursuit`
- `C3 / Lost Trail`

完成后显示按钮：

```text
返回主线：C1/C2/C3
```

点击后跳回：

```text
web/index.html?worldResult=C1
web/index.html?worldResult=C2
web/index.html?worldResult=C3
```

主线页面会读取 `worldResult`，直接进入对应分支，并清理 URL。

## Seedance 后续执行说明

要真实用 Seedance 生成 A0 新电影资产，需要先在运行环境配置：

```bash
ARK_API_KEY=你的火山方舟 Ark API Key
```

模型 ID 请以火山方舟控制台当前可用模型为准，常见示例：

```text
doubao-seedance-2-0-260128
```

推荐输入首帧：

```text
source/storyboard/approved/SB-A0-01_establishing_world.png
```

推荐输出替换目标：

```text
web/assets/video/A0-S01-establishing-seedance-web.mp4
web/assets/video/A0-S01-establishing-seedance-poster.jpg
```

然后把 `web/script.js` 的 A0 `videoAssets.A0` 切到 Seedance 版本。

## 下一步建议

1. 在公司环境配置 `ARK_API_KEY`。
2. 用 Seedance 生成 8-10 秒、16:9、电影级 A0 I2V。
3. 如果 Seedance 稳定性不好，再试 Kling I2V。
4. 保留当前 Sulphur2 v2 作为 fallback。
5. 继续把 3D 接管结果从 C1/C2/C3 扩展到更长的港口段。 
