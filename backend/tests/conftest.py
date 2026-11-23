import shutil
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    data = tmp_path_factory.mktemp("outputs")
    subprocess.run([sys.executable, str(BACKEND / "scripts" / "make_mock_data.py"), "--out", str(data), "-n", "30"],
                   check=True, capture_output=True)
    import os
    os.environ["ICM_DATA_DIR"] = str(data)
    os.environ["ICM_DB_PATH"] = str(data / "test.db")
    for m in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[m]
    sys.path.insert(0, str(BACKEND))
    from fastapi.testclient import TestClient
    from app.main import create_app
    with TestClient(create_app()) as c:
        yield c
    shutil.rmtree(data, ignore_errors=True)
