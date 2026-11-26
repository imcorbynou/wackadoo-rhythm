Bluey Music Circle

在此文件夹运行 python3 -m http.server 8000，浏览器打开 http://localhost:8000。
点击播放，角色随音乐旋转和缩放。点击左下角设置图标打开面板；点击外部或按 Esc 关闭。
Dynamics / Bass / Frequency Spectrum 为互斥单选按钮，分别响应音量、低频与七个频段。
点击角色切换舞台角色，右箭头浏览更多角色（包括 Bluey）。
音乐播放器保留播放/暂停按钮；已移除曲目信息、进度条、文件选择、静音和音量控件。
右下角全屏按钮可进入/退出全屏。
系统启用减少动态效果时，停止旋转、缩放和波形动画。

保留用户提供的原始 assets；bluey-cutout.png 和 logo.png 用于去除原图多余背景。
BlueCustard.otf 来自用户本机的 Blue_Custard_v1.01.otf。
新增角色图片来自 Bluey 官方网站：
https://www.bluey.tv/wp-content/uploads/2023/07/B2.png
https://www.bluey.tv/wp-content/uploads/2023/07/Muffin-1.png
https://www.bluey.tv/wp-content/uploads/2023/07/Dougie.png
Bluey 角色及标志版权归 Ludo Studio / BBC Studios 所有。

切换角色会同步更换整套界面颜色：Bluey 蓝色、Bingo 橙色、Muffin 灰蓝、Dougie 棕色。
歌曲标签中的波形根据实际音乐频谱和音量实时变化，暂停后停止。

设置面板：16px 内边距及区块间距，8px 模式按钮间距；两个标题为同级标题。
面板右上方 return 图标、Esc 或点击外部均可关闭。
面板展开时，宽屏圆环平滑向右移动，窄屏移到面板上方；关闭后回到中央。较矮窗口的设置内容可以滚动。
