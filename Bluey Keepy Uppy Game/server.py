#!/usr/bin/env python3
"""Local-only static server, including byte ranges for precise MP3 seeking."""
import argparse
import errno
import functools
import http.server
import os
from pathlib import Path
import re
import subprocess
import sys
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent / 'dist'
PROJECT = ROOT.parent

def ensure_music_analysis():
    environment_python = PROJECT / '.venv-allin1/bin/python'
    python = str(environment_python) if environment_python.exists() else sys.executable
    environment = dict(os.environ)
    for variable in ['OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS']:
        environment[variable] = '1'
    environment['HF_HOME'] = str(PROJECT / '.analysis/models/huggingface')
    environment['TORCH_HOME'] = str(PROJECT / '.analysis/models/torch')
    subprocess.run([python, str(PROJECT / 'scripts/analyze_allin1.py'), '--if-needed'],
                   cwd=PROJECT, env=environment, check=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript', '.otf': 'font/otf', '.mp3': 'audio/mpeg'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def send_head(self):
        self.byte_range = None
        path = self.translate_path(self.path)
        header = self.headers.get('Range')
        if not header or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', header)
        if not match or not any(match.groups()):
            self.send_error(416, 'Invalid range')
            return None
        first, last = match.groups()
        start = int(first) if first else max(0, size - int(last))
        end = min(int(last), size - 1) if first and last else size - 1
        if start >= size or start > end:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        stream = open(path, 'rb')
        stream.seek(start)
        self.byte_range = (start, end)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        return stream

    def copyfile(self, source, outputfile):
        if self.byte_range is None:
            return super().copyfile(source, outputfile)
        remaining = self.byte_range[1] - self.byte_range[0] + 1
        while remaining:
            chunk = source.read(min(65536, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--open', action='store_true')
    args = parser.parse_args()
    try:
        ensure_music_analysis()
    except subprocess.CalledProcessError:
        raise SystemExit('Automatic music analysis did not complete. The previous score is intact. Run Setup Music Analysis.command to install the analysis environment, or Reanalyze Music.command to retry.')
    server = None
    for port in range(args.port, args.port + 20):
        try:
            server = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=str(ROOT)))
            break
        except OSError as error:
            if error.errno == errno.EADDRINUSE:
                continue
            raise
    if server is None:
        raise SystemExit('No local port is available. Please close an old preview and try again.')
    url = f'http://127.0.0.1:{server.server_port}'
    print(f'Bluey Keepy Uppy Game\nLocal: {url}\nPress Control-C to stop.', flush=True)
    if args.open:
        threading.Timer(.35, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
