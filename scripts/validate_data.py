"""Validate deployable data and keep the example dataset separate from live data."""
from __future__ import annotations

import json
from pathlib import Path

from snapshot_validation import SCHEMA, SnapshotError, validate_snapshot


def validate_site_data(root: Path) -> None:
    schema = json.loads((root / "schema/snapshot-v1.schema.json").read_text(encoding="utf-8"))
    if schema != SCHEMA:
        raise SnapshotError("SCHEMA_VALIDATOR_DRIFT")
    for filename, allowed_modes in (("latest.json", {"empty", "live"}), ("demo.json", {"demo"})):
        data = json.loads((root / "data" / filename).read_text(encoding="utf-8"))
        validate_snapshot(data)
        if data["mode"] not in allowed_modes:
            raise SnapshotError(f"{filename}: WRONG_DATA_MODE")
        print(f"Valid {filename}: {data['mode']}, {len(data['matches'])} matches")


if __name__ == "__main__":
    validate_site_data(Path(__file__).resolve().parents[1])
