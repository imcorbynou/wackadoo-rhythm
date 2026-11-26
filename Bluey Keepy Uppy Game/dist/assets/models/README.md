# Google MediaPipe Gesture Recognizer

模型文件：`gesture_recognizer.task`
来源：https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task
官方文档：https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer?tab=Web
下载日期：2026-11-17
网页组件：`@mediapipe/tasks-vision` 1.2.3（随项目本地提供 JS 和 WASM）。

## 如何使用

打开游戏并允许摄像头。识别最多两只手，摄像头相框下方显示英文手势名称。
手部 PNG 跟随检测到的手掌位置；没有检测到手时留在最后的位置。
识别到手（包括 Open_Palm）时移动手部指针。Closed_Fist 稳定约60毫秒后触发一次左键点击，并播放720毫秒的手部 GIF；持续握拳不会重复点击，明确松手120毫秒后才接受下一次。
鼠标点击和原有键盘操作仍可使用。GIF 依据原画布透明边距对齐 PNG。有效击中的气球以约2.8秒慢速向上飞出屏幕；音乐及评分规则保持原样。

| 模型输出 | 动作 |
| --- | --- |
| Open_Palm | 张开手掌 |
| Closed_Fist | 握拳 |
| Pointing_Up | 食指向上 |
| Thumb_Up | 竖起拇指 |
| Thumb_Down | 拇指向下 |
| Victory | 食指和中指比 V |
| ILoveYou | 拇指、食指、小指伸出（美式手语 I love you） |
| None | 检测到手，但不属于上述手势 |

没有检测到手时输出空数组，和 `None` 不同。
模型识别的是手的姿势；“向上推”“挥手”等连续动作需要根据最近数帧的位置变化另写判断。

## 后续绑定入口

`dist/gesture-input.mjs` 每次识别后发出 `keepy:gestures` 自定义事件。
事件的 `detail` 为官方原始结果，包含 `gestures`、`landmarks`、`worldLandmarks` 和 `handedness`/`handednesses`（随 SDK 版本）。
各数组的同一索引对应同一只手；两手数组顺序可能变化，不应把索引固定当作左手或右手。
输入图像已镜像用于屏幕指针；如需身体左右手语义，必须考虑镜像对 handedness 的影响。
可根据 `gestures[i][0].categoryName` 分配作用；移动动作则使用 `landmarks[i]` 的21个关键点及时间序列。

安全触发建议：姿势短暂稳定后只触发一次，松开或换回准备姿势后再允许下一次。
