# Bluey video homepage

双击“启动网页.command”，或在本文件夹运行 `node server.mjs`，打开 http://127.0.0.1:8938 。无需安装依赖。

悬停/聚焦/点击歌名切换封面与试听。同一时间只有一首预览播放。浏览器第一次有声播放可能需要点击歌名。play now! 始终是进入下一页的按钮，不会变成 pause；点击后进入 music-circle/index.html，并通过 song 参数加载选中歌曲。

固定主题色：Bluey Theme Tune 歌单 #73A6C7、play now #83C7F8；Burger Dog #E63E5A；Dance Mode #6513C5；Sleepytime #12143B；Verandah Santa #3E3797。未选中歌名为当前歌曲主题色，白色底；选中歌名白字、有色底。所有歌名保持单行，小屏幕会自动缩小长歌名字号。

music-circle 是用户现有 Bluey-Music-Circle 的整合副本，保留角色、设置、可视化和播放功能，并加入选中歌曲入口。主题曲使用原 MP4 音轨，其他四首使用 assets 内对应 MP3。原始独立 Music Circle 文件夹未修改。

背景视频固定左下角，桌面宽度三分之一，手机宽度78vw，静音循环。每轮前40秒采样背景，40秒起冻结背景，下一轮恢复；画面一直继续。服务器支持 MP4/MP3 Range 请求。请通过本地 HTTP 服务预览。
