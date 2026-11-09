# MetaHuman：角色和表情快速上手

本项目使用 UE 5.8.1。Creator、Animator 和 Live Link 插件已写入项目设置，
现有 Unreal 编辑器需保存并关闭后重新打开才能加载。

## 第一次使用：安装官方核心数据

当前机器的 UE 缺少 **MetaHuman Creator Core Data**。插件本体在，但角色预设、
皮肤和其他编辑功能会受限。安装不会自动替代或修改项目里的 Kelly。

1. 在当前 Unreal 编辑器保存工作并关闭所有 UE 项目。
2. 打开 Epic Games Launcher → **虚幻引擎 / Unreal Engine** → **库 / Library**。
3. 在 UE 5.8 版本的菜单中选 **选项 / Options**，勾选 **MetaHuman Creator Core Data**，点击 **应用 / Apply**，等待下载和安装完成。
4. 双击本项目 `ue/Start-MetaHuman.bat`。脚本检查数据、创建初始角色资产并打开编辑器；如果角色已经存在，只打开项目，不覆盖它。

如 UE 装在其他位置，设置 `NEON_UE_ROOT` 指向该 UE 5.8 目录，或在 PowerShell
运行 `ue/Start-MetaHuman.ps1 -UEPath <引擎目录>`。需要先在 Launcher 安装 UE、
核心数据并登录对应 Epic 账号。脚本不会自动关闭已有编辑器，也不会保存或丢弃其工作。

## 制作第一个角色

1. 在 Content Browser 打开 `Content/MetaHumanWorkspace/Characters`，双击 `Heroine_MetaHuman`。
2. 在 MetaHuman Creator 中选择基础角色，调整脸、身体、皮肤、头发和服装，保存。
3. 在 Assembly 面板选择 **UE Cine**，生成可放入关卡的角色蓝图。游戏实时使用可考虑 **UE Optimized**，需要另做画质与性能验证。
4. 根据提示下载所需的高分辨率纹理；这可能需要 Epic 服务连接。组装完成后保存新资产，将角色蓝图拖入关卡。

这是一个可编辑的起始角色，不是已经制作好的 Kelly，也尚未自动接入摩托车或游戏。
默认组装目录为 `Content/MetaHumans`。若更改输出目录，先确认该目录的资产也会被同步。

## 最容易上手的表情：摄像头实时驱动

1. 连接摄像头，在 Unreal 中打开 **Window → Virtual Production → Live Link**。
2. 添加 **MetaHuman Video Source**，选择摄像头并创建 Subject。
3. 打开角色资产，在 **Preview Settings → Animation** 将 **Animation Controller** 设为 **LiveLink**，选择刚才创建的 Subject，即可在 Creator 预览表情。
4. 如需在关卡中驱动已组装的角色，在角色蓝图实例的 **Live Link** 区域勾选 **Use Live Link** 并选择同一 Subject。

第一次使用可能需要操作系统提供摄像头访问权限。实时画质、延迟和跟踪效果取决于摄像头、光线与机器负载；本机尚未进行摄像头实测。
手机可通过官方 Live Link Face 工作流连接；不同设备的支持情况以 Epic 文档为准。

## 音频生成表情

1. 把音频导入 `Content/MetaHumanWorkspace` 下的文件夹，UE 会创建 SoundWave。
2. 在内容浏览器右键 → **MetaHuman Animator → MetaHuman Performance**，双击新资产。
3. 将 **Input Type** 设为 **Audio**，选择 SoundWave，在 **Visualization Mesh** 选择角色脸部网格，点击 **Process**。
4. 处理完成后选择 **Export Animation** 或 **Export Level Sequence**；后者需要指定组装好的角色蓝图。可调整眨眼、情绪和强度。

音频驱动主要依据声音生成面部动作；它不是对真实面部表演的完整重建。当前只验证了插件和资产创建，尚未使用音频或摄像头完成端到端生成。

## 跨电脑和隐私

角色工作目录 `Content/MetaHumanWorkspace/` 和默认组装目录 `Content/MetaHumans/`
不会提交到公开仓库；项目的正常完成同步会将这些目录中的资产上传到已配置的私有资产库。
引擎核心数据和 Epic/Fab 账号权限需在每台机器各自安装或恢复，不放进项目备份。
保存音频、Performance 和导出动画时请放入上述工作目录；自选目录、关卡、外部音频/视频或 Fab 资源不会自动因本设置而进入私有备份，需另行登记。

## 官方参考

- [安装核心数据和启用 Creator](https://dev.epicgames.com/documentation/en-us/metahuman/getting-started-with-metahuman-creator)
- [创建和组装角色](https://dev.epicgames.com/documentation/en-us/metahuman/creating-a-character)
- [Live Link 实时表情](https://dev.epicgames.com/documentation/metahuman/connecting-a-live-link-subject-to-your-metahuman)
- [音频驱动表情](https://dev.epicgames.com/documentation/en-us/metahuman/audio-driven-animation)
