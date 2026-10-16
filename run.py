#!/usr/bin/env python3
"""Run URBAN-EYES locally for development/demo."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

# Auto-switch to .venv python if executed under system or IDE default python
venv_dir = ROOT / ".venv"
venv_python = venv_dir / "bin" / "python"
if venv_python.exists() and Path(sys.prefix).resolve() != venv_dir.resolve():
    os.environ["VIRTUAL_ENV"] = str(venv_dir)
    os.execv(str(venv_python), [str(venv_python)] + sys.argv)

# Extra fallback: inject .venv site-packages directly if execv is bypassed
for sp in (venv_dir / "lib").glob("python*/site-packages"):
    if sp.is_dir() and str(sp) not in sys.path:
        sys.path.insert(0, str(sp))

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")), reload=True)

