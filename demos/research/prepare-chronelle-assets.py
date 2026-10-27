"""Apply a focused local patch without touching the neighboring dirty checkout."""
import shutil
import subprocess
import tempfile
from pathlib import Path

def prepare():
    source = Path(__file__).resolve().parents[4] / 'Calendar' / 'chronelle-backend' / 'calendar_extras' / 'embed_assets'
    directory = Path(tempfile.mkdtemp(prefix='frienden-calendar-selection-'))
    assets = directory / 'embed_assets'
    shutil.copytree(source, assets)
    subprocess.run(['git', 'apply', '--unidiff-zero', str(Path(__file__).with_name('chronelle-selection.patch'))], cwd=assets, check=True)
    return directory

if __name__ == '__main__':
    print(prepare())
