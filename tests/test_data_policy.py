"""The site's publishable filename must never silently become a demo dataset."""
import contextlib
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from snapshot_validation import SCHEMA, SnapshotError
from validate_data import validate_site_data


class DataPolicyTest(unittest.TestCase):
    def test_repository_data_passes_site_boundary(self):
        with contextlib.redirect_stdout(io.StringIO()):
            validate_site_data(ROOT)

    def test_demo_cannot_replace_latest(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / "schema").mkdir()
            (root / "schema/snapshot-v1.schema.json").write_text(json.dumps(SCHEMA), encoding="utf-8")
            shutil.copytree(ROOT / "data", root / "data")
            shutil.copyfile(root / "data/demo.json", root / "data/latest.json")
            with self.assertRaisesRegex(SnapshotError, "WRONG_DATA_MODE"):
                validate_site_data(root)


if __name__ == "__main__":
    unittest.main()
