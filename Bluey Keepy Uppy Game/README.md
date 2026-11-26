# Bluey Keepy Uppy Game

本地运行的节奏记忆游戏。保留庭院界面、角色动画和“先听音乐，再拍气球”的流程。

## 打开游戏

双击 `Start Game.command`。默认地址为 http://127.0.0.1:8765。

首次准备分析环境或更换电脑时，运行 `Setup Music Analysis.command`，需要网络下载依赖和模型。环境准备好、歌曲未改变时，启动直接读取已保存的分段，不重复下载或推理。不要直接双击 dist/index.html。

## 当前音乐分段：All-In-One

本版接入用户指定的官方项目 https://github.com/mir-aidj/all-in-one ，源码提交固定为 `18e78903c0365147a2c5d4e5e57ebf88cb7d800e`。使用 `harmonix-all` 模型识别拍点、小节首拍及歌曲段落。

当前回合按模型检测到的小节首拍划分，通常组合四个小节，再从每小节选择 1–2 个真实节拍，目标每轮 6–7 个气球。歌曲开头从 8 秒独白之后开始，结尾保留实际余下节拍；不强行凑齐数量。

当前共 16 轮，每轮实际出现 6 或 7 个气球，共 104 个游戏提示。完整谱面仍保留 256 个原始检测节拍，网页从中选取提示；不改动被选节拍的时间和颜色。原来 26 次较短音乐片段合并为 16 次较长片段，开头独白和全曲长度保留。

网页与模型均使用同一份解码后的 WAV，减少不同 MP3 解码器时间偏移造成的错位。原 MP3 保留在 assets 中，WAV 由分析脚本生成。

## 游戏流程

- Feel the Rhythm：播放当前短片段，依次显示颜色提示。
- Keepy Uppy：音乐暂停，倒数准备，然后按记忆点击气球。
- 各难度均选择每小节 1–2 个真实节拍，普通四小节组形成 6–7 个提示。不会回退为早期每轮只有两三个提示。
- 上方使用无数字的小气球提示，当前提示会放大。
- 下落气球不显示数字；外层是同色同款气球，从较大、约 28% 不透明度逐渐缩小，目标拍达到正常大小和 100% 不透明度。
- 气球从高处下落，在画面中部到达目标时间；拍中后弹起。
- 分别显示节奏与颜色分数，随后继续下一片段。

鼠标、触屏均可。键盘 1=蓝、2=绿、3=黄、4=红。空格暂停/继续，Esc 暂停；切到其他标签页自动暂停。

## 重新分析与缓存

更换 `dist/assets/Keepy Uppy.mp3` 或修改 `analysis-config.json` 后，下次启动会检查并更新分析。强制运行模型：双击 `Reanalyze Music.command`。

当前最后一步由 `scripts/bar_rounds.py` 按小节重新组织回合。`phrases` 配置保留供原始分析候选使用，最终游戏回合以真实 downbeat 和约四小节的分组为准。

- `dist/score.json`：网页谱面；每轮 start/end 为全曲绝对秒数，notes.time 为本轮相对秒数。
- `dist/music-analysis.json`：模型来源、歌曲段落、最终暂停点、候选切点和选择原因。
- `.analysis/allin1/<音频摘要>/model-result.json`：All-In-One 原始结果。
- `.analysis/allin1/<音频摘要>/demix/`：分离后的音轨，供停顿分析使用。
- `.analysis/models/`：下载的模型缓存。
- `.analysis/score-before-allin1.json`：切换前的谱面备份。

模型推理和停顿分析在本机进行，不上传歌曲。音频、模型与分析参数共同用于检查缓存；分析失败会保留原有可播放谱面。

## 代码与验证

- `scripts/analyze_allin1.py`：官方模型调用、缓存、共享音频、谱面生成。
- `scripts/phrase_candidates.py`：根据段落变化、人声停顿与小节生成候选切点。
- `scripts/phrase_structure.py`：选择片段长度并生成连续关卡。
- `scripts/analyze_music.py`：保留原分析工具及颜色分析函数。
- `scripts/bar_rounds.py`：按约四个真实小节组织更长的回合，也可直接对已保存的谱面执行，无需重新下载模型。
- `dist/practice.mjs`：从每小节选 1–2 个节拍，总计每轮 6–7 个提示。
- `dist/core.mjs`：点击判定及两项评分。
- `dist/cue-stream.mjs`：共享时间、颜色事件及暂停/重启通知。

运行 `npm test` 和 `.venv-allin1/bin/python -m unittest discover -s tests -p 'test_*.py'`。

## 背心状态

目前不连接 ESP32。网页已预留共享事件接口；接入真实背心需要 UUID、马达位置、报文格式和时钟同步验证。未连接背心时游戏正常运行。

## 来源与许可证

All-In-One 的官方源码与 MIT 许可证保存在 `vendor/all-in-one`，`UPSTREAM.json` 记录来源和提交。

原 madmom 源码、模型及许可证继续保留在 `vendor/madmom`。源码采用 BSD 许可证，madmom 模型采用 CC BY-NC-SA 4.0；详见相应 LICENSE 文件。新分析环境复用原有 `.venv-madmom` 内固定版本的数值库和 madmom，同时独立安装 All-In-One 所需组件。


## Camera gesture controls

The game automatically requests camera access when opened. Allow access in Safari when prompted. You can still turn the camera off or retry using the camera button.

The blue hands pointer stays visible at all times, including while loading, during uncertain predictions, when wrist tracking is temporarily lost, and when the camera is off. Wrist positions move the pointer independently of the trained gesture labels. Missing positions leave it at the last known location. When the camera is off, moving the mouse moves the hands pointer.

Only **push the ballon up** is used to decide a tap. A confident push while the hands touch a balloon triggers the existing timed tap and plays `push the ballon.gif` once. No preceding Hold classification is required. Release the push before another tap; a held push or brief classification flicker cannot repeatedly score. Listening, pause and missing wrist positions cannot trigger taps.

The latest two-class Pose model is bundled locally from https://teachablemachine.withgoogle.com/models/Miy-NLmWz/ (export timestamp: 2026-11-16T08:42:45.613Z). Its labels are `hold the ballon` and `push the ballon up`; the first label does not gate pointer movement or visibility.

The English artwork and listen-then-play game remain in place. Start/pause controls remain clickable. Gesture mode replaces balloon mouse clicks while ready; turning the camera off restores mouse input. Video is processed locally and microphone access is not requested.


### Pointer response and push animation

The pointer uses 1.35× horizontal and 1.25× vertical sensitivity, with 18 ms smoothing. The inference loop checks for a new camera frame at a minimum interval of 30 ms, with only one prediction in flight; actual camera-to-screen latency depends on the device.

A push is confirmed across two positive samples at least 30 ms apart. To tolerate normal camera/gesture timing differences, actual balloon contact is remembered for 150 ms and a newly confirmed push can wait up to 200 ms for contact. The same held push cannot repeat, and old/missing tracking or removed balloons cannot score. Empty-space pushes do not play the balloon animation.

The supplied GIF is decoded before replacing the PNG, then displayed for its full 720 ms before returning to the PNG. The original English artwork, music, phrase boundaries and scoring are unchanged.

## 2026-11-21 布局更新

左侧标题、小气球提示和摄像头白色主体按原 PNG 的可见边界对齐。相框底部装饰与 Round 文字之间单独留出间距。
窗口及全屏共用 `dist/hud-layout.mjs` 的布局计算：四周安全留白为短边的 3%，最小 16px、最大 32px，水平与垂直使用同一数值，不绘制灰色辅助方块。
`dist/layout.mjs` 在窗口大小或全屏状态变化时更新布局及活动范围。
气球活动区是左侧完整 UI 之外的右侧矩形，保留顶部、右侧及底部留白；位置不再限制于原来的狭窄紫色多边形。路线覆盖右侧各列，包含较大的半透明外层也不会进入左侧 UI。
16 轮、每轮 6–7 个气球、原始节拍和手势素材保持不变。
