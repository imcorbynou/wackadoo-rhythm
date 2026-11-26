#!/bin/zsh
# Finder 双击即可启动；始终从游戏所在文件夹运行。
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:/Library/Frameworks/Python.framework/Versions/Current/bin:$PATH"
printf '\n正在打开 Bluey 气球游戏，请稍候……\n网页打开后，请保留此终端窗口；关闭窗口会停止游戏服务。\n\n'
if ! command -v python3 >/dev/null 2>&1; then
  printf '未找到 Python 3，请先安装 Python 3 后再双击此文件。\n按回车键关闭。'
  read -r
  exit 1
fi
exec /bin/zsh './Start Game.command'
