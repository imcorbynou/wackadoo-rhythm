"""Install madmom into a project-local environment, without global changes."""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def compatible_python():
    candidates = [
        str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3'),
        *[shutil.which(name) for name in ['python3.12', 'python3.11', 'python3.10', 'python3.9']],
        '/usr/bin/python3', sys.executable,
    ]
    for candidate in candidates:
        if not candidate or not Path(candidate).exists():
            continue
        result = subprocess.run([candidate, '-c', 'import sys; print("%s.%s" % sys.version_info[:2])'], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip() in ['3.9', '3.10', '3.11', '3.12']:
            return candidate
    raise RuntimeError('Install Python 3.12 and retry. This project uses an isolated Python 3.9–3.12 environment for madmom.')

def main():
    environment = ROOT / '.venv-madmom'
    python = environment / 'bin/python'
    if not python.exists():
        subprocess.run([compatible_python(), '-m', 'venv', str(environment)], check=True)
    subprocess.run([str(python), '-m', 'pip', 'install', '--no-cache-dir', '--upgrade', 'pip'], check=True)
    subprocess.run([str(python), '-m', 'pip', 'install', '--no-cache-dir', '-r', str(ROOT / 'requirements-analysis.txt')], check=True)
    subprocess.run([str(python), '-m', 'pip', 'install', '--no-build-isolation', '--no-deps', str(ROOT / 'vendor/madmom')], check=True)
    subprocess.run([str(python), str(ROOT / 'scripts/analyze_music.py'), '--if-needed'], check=True)
    print('Music analysis is ready. Open Start Game.command to play.')

if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
