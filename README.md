# Wackadoo Rhythm! (Bluey X Deaf Connect)

用于作品集评审的互动网页。包含主页、Spinny Roundy / Music Circle、背心连接演示和 Keepy Uppy 游戏。

## 发布到 GitHub Pages

建议仓库名：`wackadoo-rhythm`。作品完整展示名为 **Wackadoo Rhythm! (Bluey X Deaf Connect)**。

1. 将本文件夹作为 Git 仓库上传到自己的 GitHub 公开仓库，默认分支使用 `main`。文件夹内文件应位于仓库根目录，不要只上传 ZIP。
2. 打开仓库 **Settings → Pages → Build and deployment → Source → GitHub Actions**。
3. 在 **Actions → Publish portfolio website → Run workflow** 运行工作流，或推送一次提交。
4. 工作流成功后，打开部署页面显示的网址，将该网址放到作品集中。评审无需 GitHub 登录即可访问公开 Pages 网站。

网站发布地址：`https://imcorbynou.github.io/wackadoo-rhythm/`。首次部署成功后可通过此地址访问。

源代码仓库：`https://github.com/imcorbynou/wackadoo-rhythm`。

项目包含较大媒体文件，使用 Git 或 GitHub Desktop 上传，避免网页上传单文件大小限制。发布流程不需要安装 npm 依赖。

## 本地运行与检查

需要 Node.js 22 或更新版本。

```sh
npm start
```

打开 `http://127.0.0.1:8940/`。原 Node 服务和局域网照片功能保留在源代码中。

```sh
npm test
PAGES_BASE_PATH=/wackadoo-rhythm npm run build:pages
```

`_site/` 为生成的静态网站，已从 Git 忽略。工作流会根据 GitHub Pages 的实际路径生成网页、素材、模块和导航地址，支持仓库子目录部署。

## 在线体验说明

主页点击一次全屏后，选歌、游戏跳转、返回主页及重新开始均在同一全屏页面内完成。按 Esc 或再次点击主页全屏按钮可退出；浏览器自身切换标签页或窗口的行为由浏览器控制。


- 主页、歌曲、动画、游戏和浏览器手势模型使用静态文件。
- 摄像头需要访客允许权限；手势模型运行在浏览器中。用户也可以使用鼠标操作。
- 浏览器可能要求鼠标点击后才能播放声音或进入全屏。
- 背心连接页沿用原演示逻辑；发布不会新增远程硬件连接能力。
- GitHub Pages 不运行 Node.js 照片接口。在线版本在游戏结束后可将拍摄照片下载到当前设备，不显示跨设备传照片二维码，也不上传照片。
- 原始 Node 版本仍支持原局域网照片流程；如果需要互联网跨设备照片分享，需另行配置有后端的托管服务。

GitHub Pages 官方发布说明：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
