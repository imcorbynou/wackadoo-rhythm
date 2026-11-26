# Bluey Vest Connect

双击“打开连接页.command”预览本页，或在旁边的 bluey homepage 文件夹里双击“打开主页.command”从首页开始。
三个文件夹保持在同一目录：bluey homepage、Bluey Vest Connect、Bluey Keepy Uppy Game。需要 Node.js。

流程：首页点击 Keepy Uppy → /vest-connect/ → 点击 Connect Vest → 蓝牙 SVG 图标左右倾斜约 14°，7 秒后显示 successful.png → 成功图显示 5 秒 → /keepy-uppy/。

默认/悬停按钮的文字和成功按钮使用提供的 PNG；蓝牙图标使用 bluetooth.svg，保持原尺寸和 #73A6C7 蓝色，悬停为白色。背景使用 loop background.mp4，字体复用首页的 Blue Custard。减少动态效果的系统设置会关闭图标摆动及背景播放，流程时间不变。

这是定时连接演示，不会搜索或连接真实蓝牙硬件。真实设备接入需要背心的蓝牙服务 UUID、特征 UUID 和通信协议。

可以直接打开 index.html 查看页面与跳转，但游戏的摄像头和模块功能请通过启动文件提供的 localhost 地址使用。
若首页服务已经在运行，修改后请先在原终端按 Control-C 停止，再重新打开“打开主页.command”。
