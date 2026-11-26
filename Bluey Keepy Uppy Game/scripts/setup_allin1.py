"""Install the pinned official All-In-One source alongside the existing analyzer."""
from pathlib import Path
import os
import hashlib
import tarfile
import subprocess
import sys
from setup_analysis import compatible_python
ROOT=Path(__file__).resolve().parents[1]

def main():
    old_python=ROOT/'.venv-madmom/bin/python'
    if not old_python.exists():
        subprocess.run([sys.executable,str(ROOT/'scripts/setup_analysis.py')],check=True)
    env=ROOT/'.venv-allin1';python=env/'bin/python'
    if not python.exists():subprocess.run([compatible_python(),'-m','venv',str(env)],check=True)
    # Share the previously pinned madmom/NumPy/SciPy build; all additional packages
    # live in the new environment. Never overwrite the original analyzer.
    version=subprocess.check_output([str(python),'-c','import sys;print(f"python{sys.version_info.major}.{sys.version_info.minor}")'],text=True).strip()
    source=ROOT/'.venv-madmom/lib'/version/'site-packages';target=env/'lib'/version/'site-packages'
    if not source.is_dir():raise RuntimeError('Use the same Python version as .venv-madmom for All-In-One setup.')
    for path in source.iterdir():
        if path.name.startswith('.') or path.name.endswith('.pth') or path.name=='__pycache__' or path.name.startswith('pip'):continue
        if not (target/path.name).exists():(target/path.name).symlink_to(path,target_is_directory=path.is_dir())
    subprocess.run([str(python),'-m','pip','install','--use-pep517','-r',str(ROOT/'requirements-allin1.txt')],check=True)
    build_env=dict(os.environ,NATTEN_N_WORKERS='4')
    build_env['PATH']=str(env/'bin')+os.pathsep+build_env.get('PATH','')
    archive=ROOT/'vendor/natten-0.17.1.tar.gz'
    if hashlib.sha256(archive.read_bytes()).hexdigest() != 'a2142722faa41fa3ae6d22e91ed527b2a6da5c4fe09a006f36d68edccaf9c643':
        raise RuntimeError('NATTEN source archive failed its official PyPI checksum.')
    build=ROOT/'.analysis/build';build.mkdir(parents=True,exist_ok=True)
    with tarfile.open(archive) as stream:stream.extractall(build,filter='data')
    native=build/'natten-0.17.1'
    cmake=native/'csrc/CMakeLists.txt'
    cmake.write_text(cmake.read_text().replace('from distutils import sysconfig; print(sysconfig.get_python_inc());', "import sysconfig; print(sysconfig.get_path('include'));"))
    setup=native/'setup.py'
    setup.write_text(setup.read_text().replace('cmake_args = [','cmake_args = [\n            "-DCMAKE_BUILD_TYPE=Release",\n            "-DCMAKE_POLICY_VERSION_MINIMUM=3.5",'))
    subprocess.run([str(python),'-m','pip','install','--no-build-isolation','--no-deps',str(native)],env=build_env,check=True)
    subprocess.run([str(python),'-m','pip','install','--no-deps',str(ROOT/'vendor/all-in-one')],check=True)
    subprocess.run([str(python),str(ROOT/'scripts/analyze_allin1.py'),'--if-needed'],check=True)
    print('All-In-One phrases are ready. Open Start Game.command.')

if __name__=='__main__':main()
