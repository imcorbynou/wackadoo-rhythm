#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export BLUEY_START_PATH='/keepy-uppy/'
exec node '../bluey homepage/server.mjs' --open
