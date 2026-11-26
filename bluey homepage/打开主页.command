#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  printf '请先安装 Node.js，然后重新打开主页。\n按回车退出。'
  read -r
  exit 1
fi
exec node server.mjs --open
