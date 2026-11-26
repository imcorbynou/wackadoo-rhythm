#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if [[ ! -x .venv-allin1/bin/python ]]; then
  print "Run Setup Music Analysis.command first."
  exit 1
fi
export OPENBLAS_NUM_THREADS=1
export OMP_NUM_THREADS=1
export VECLIB_MAXIMUM_THREADS=1
exec .venv-allin1/bin/python scripts/analyze_allin1.py --force
