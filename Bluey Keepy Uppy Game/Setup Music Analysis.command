#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
exec /usr/bin/env python3 scripts/setup_allin1.py
