# Bluey homepage

双击 `打开主页.command` 启动，保持终端窗口开启。无需安装项目依赖。

主页位于 `index.html`，使用 `styles.css` 和 `app.js`。原有素材保持原样，网页使用另存的轻量版本。

- Spinny Roundy → 同级 `bluey select song/index.html`
- Keepy Uppy → 同级 `Bluey Keepy Uppy Game/dist/index.html`

启动服务把这两个文件夹分别挂载在 `/spinny-roundy/` 和 `/keepy-uppy/`。游戏文件不被修改，文件夹应保持在同一目录。通过服务访问，游戏的模块、音乐和摄像头可以正常加载。直接双击 HTML 可以查看主页，但进入游戏请使用启动脚本。

两个静音视频转为 H.264 MP4，去除音轨，提前加载；末尾 0.35 秒与开头溶解衔接，双播放器在收到实际视频帧后切换，避免跳回开头时闪黑。低动态偏好下显示静态封面；切换到后台会暂停播放。

背景和文字颜色取自原始素材 `#a6dcff`，字体为本地 BlueCustard。鼠标悬停时左侧按钮向左旋转 5°、右侧按钮向右旋转 5°，键盘 Tab 可聚焦，Enter 可进入游戏。手机竖屏自动改为上下排列。

若需要调整链接，修改 `index.html` 的 `href`、`data-route` 和 `server.mjs` 的 `mounts`。
