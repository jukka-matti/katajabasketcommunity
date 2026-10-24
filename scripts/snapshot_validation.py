"""Dependency-free snapshot contract, shared verbatim with the website validator.

SCHEMA is JSON Schema draft 2020-12. The small validator below deliberately
implements only the keywords used by this contract, plus cross-record checks.
It is not a general JSON Schema engine.
"""
from __future__ import annotations

import argparse
from datetime import datetime
import json
import math
from pathlib import Path
import re
from urllib.parse import urlsplit


class SnapshotError(ValueError):
    pass


def obj(properties):
    return {"type": "object", "properties": properties,
            "required": list(properties), "additionalProperties": False}


def arr(items, unique=False):
    result = {"type": "array", "items": items, "maxItems": 20000}
    if unique:
        result["uniqueItems"] = True
    return result


TEXT = {"type": "string", "minLength": 1, "maxLength": 1000}
ID = {"type": "string", "minLength": 1, "maxLength": 180,
      "pattern": r"^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$"}
NULL_TEXT = {**TEXT, "type": ["string", "null"]}
URL = {**TEXT, "maxLength": 3000, "format": "https-url"}
NULL_URL = {**URL, "type": ["string", "null"]}
DATE = {**TEXT, "format": "date-time"}
NULL_DATE = {**DATE, "type": ["string", "null"]}
COUNT = {"type": "integer", "minimum": 0}
NULL_COUNT = {**COUNT, "type": ["integer", "null"]}

SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://github.com/jukka-matti/katajabasketcommunity/schema/snapshot-v1.schema.json",
    "title": "Kataja public basketball snapshot v1",
    **obj({
        "schemaVersion": {"type": "integer", "const": 1},
        "mode": {"type": "string", "enum": ["empty", "demo", "live"]},
        "generatedAt": NULL_DATE,
        "timezone": {"type": "string", "const": "Europe/Helsinki"},
        "sources": arr(obj({"id": ID, "label": TEXT, "url": URL, "fetchedAt": DATE})),
        "teams": arr(obj({"id": ID, "name": TEXT, "shortName": TEXT,
            "category": {"type": "string", "enum": ["adult", "junior"]},
            "tracked": {"type": "boolean"}, "competitionIds": arr(ID, True)})),
        "competitions": arr(obj({"id": ID, "name": TEXT, "season": TEXT, "phase": NULL_TEXT})),
        "venues": arr(obj({"id": ID, "name": TEXT, "city": NULL_TEXT, "address": NULL_TEXT})),
        "matches": arr(obj({"id": ID, "competitionId": ID, "homeTeamId": ID,
            "awayTeamId": ID, "startsAt": NULL_DATE,
            "status": {"type": "string", "enum": ["scheduled", "final", "postponed", "cancelled", "time-tbc"]},
            "venueId": {**ID, "type": ["string", "null"]},
            "homeScore": NULL_COUNT, "awayScore": NULL_COUNT,
            "sourceId": ID, "sourceUrl": URL})),
        "standings": arr(obj({"competitionId": ID,
            "status": {"type": "string", "enum": ["available", "not-published", "unavailable"]},
            "rows": arr(obj({"position": {"type": "integer", "minimum": 1},
                "teamId": ID, "played": COUNT, "wins": COUNT, "losses": COUNT,
                "points": {"type": ["number", "null"]}})),
            "sourceId": {**ID, "type": ["string", "null"]}, "sourceUrl": NULL_URL})),
        "coverage": obj({"teamIds": arr(ID, True), "note": NULL_TEXT}),
    }),
}


def timestamp(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError) as exc:
        raise SnapshotError("INVALID_DATETIME") from exc
    if "T" not in value or parsed.tzinfo is None or parsed.utcoffset() is None:
        raise SnapshotError("TIMEZONE_REQUIRED")
    return parsed


def _typed(value, kind):
    return {"null": lambda: value is None, "object": lambda: isinstance(value, dict),
            "array": lambda: isinstance(value, list), "string": lambda: isinstance(value, str),
            "boolean": lambda: type(value) is bool, "integer": lambda: type(value) is int,
            "number": lambda: type(value) in (int, float) and math.isfinite(value)}[kind]()


def _check(value, rule, path):
    kinds = rule["type"] if isinstance(rule["type"], list) else [rule["type"]]
    if not any(_typed(value, kind) for kind in kinds):
        raise SnapshotError(f"{path}: INVALID_TYPE")
    if value is None:
        return
    if "const" in rule and value != rule["const"]:
        raise SnapshotError(f"{path}: INVALID_CONSTANT")
    if "enum" in rule and value not in rule["enum"]:
        raise SnapshotError(f"{path}: INVALID_ENUM")
    if isinstance(value, dict):
        expected = set(rule["properties"])
        if set(value) != expected:
            raise SnapshotError(f"{path}: MISSING_OR_UNKNOWN_FIELDS")
        for key, subrule in rule["properties"].items():
            _check(value[key], subrule, path + "." + key)
    elif isinstance(value, list):
        if len(value) > rule.get("maxItems", 20000):
            raise SnapshotError(f"{path}: TOO_MANY_ITEMS")
        for index, item in enumerate(value):
            _check(item, rule["items"], f"{path}[{index}]")
        if rule.get("uniqueItems") and len(value) != len(set(value)):
            raise SnapshotError(f"{path}: DUPLICATE_ITEM")
    elif isinstance(value, str):
        if not value.strip() or len(value) > rule.get("maxLength", 1000):
            raise SnapshotError(f"{path}: INVALID_STRING")
        if "pattern" in rule and not re.fullmatch(rule["pattern"], value):
            raise SnapshotError(f"{path}: INVALID_IDENTIFIER")
        if rule.get("format") == "date-time":
            timestamp(value)
        if rule.get("format") == "https-url":
            try:
                url = urlsplit(value)
                valid = url.scheme == "https" and bool(url.hostname) and not url.username and not url.password and url.port in (None, 443)
            except ValueError:
                valid = False
            if not valid or any(c.isspace() for c in value):
                raise SnapshotError(f"{path}: INVALID_HTTPS_URL")
    elif type(value) in (int, float) and value < rule.get("minimum", -math.inf):
        raise SnapshotError(f"{path}: NEGATIVE_VALUE")


def validate_snapshot(data: dict, *, live_only: bool = False) -> dict:
    """Validate without changing the supplied public payload; return it on success."""
    _check(data, SCHEMA, "snapshot")
    if live_only and data["mode"] != "live":
        raise SnapshotError("LIVE_SNAPSHOT_REQUIRED")
    lists = ("sources", "teams", "competitions", "venues", "matches")
    indexes = {}
    for name in lists:
        indexes[name] = {item["id"]: item for item in data[name]}
        if len(indexes[name]) != len(data[name]):
            raise SnapshotError(name + ": DUPLICATE_ID")
    if data["mode"] == "empty":
        if data["generatedAt"] is not None or any(data[name] for name in (*lists, "standings")) or data["coverage"]["teamIds"]:
            raise SnapshotError("INVALID_EMPTY_SNAPSHOT")
        return data
    if data["generatedAt"] is None:
        raise SnapshotError("GENERATED_AT_REQUIRED")
    generated = timestamp(data["generatedAt"])
    for source in data["sources"]:
        if timestamp(source["fetchedAt"]) > generated:
            raise SnapshotError("SOURCE_AFTER_SNAPSHOT")
    teams, competitions = indexes["teams"], indexes["competitions"]
    tracked = {team["id"] for team in data["teams"] if team["tracked"]}
    covered = set(data["coverage"]["teamIds"])
    if not covered or not covered <= tracked:
        raise SnapshotError("INVALID_COVERAGE")
    if covered != tracked and not data["coverage"]["note"]:
        raise SnapshotError("PARTIAL_COVERAGE_NOTE_REQUIRED")
    if not data["sources"]:
        raise SnapshotError("SOURCE_REQUIRED")
    for team in data["teams"]:
        if not set(team["competitionIds"]) <= set(competitions):
            raise SnapshotError("TEAM_COMPETITION_REFERENCE")
    for match in data["matches"]:
        if match["competitionId"] not in competitions or match["homeTeamId"] not in teams or match["awayTeamId"] not in teams:
            raise SnapshotError("MATCH_REFERENCE")
        if match["homeTeamId"] == match["awayTeamId"]:
            raise SnapshotError("MATCH_SAME_TEAM")
        if match["sourceId"] not in indexes["sources"] or (match["venueId"] is not None and match["venueId"] not in indexes["venues"]):
            raise SnapshotError("MATCH_SOURCE_OR_VENUE_REFERENCE")
        for team_id in (match["homeTeamId"], match["awayTeamId"]):
            if match["competitionId"] not in teams[team_id]["competitionIds"]:
                raise SnapshotError("MATCH_TEAM_COMPETITION")
        scores = (match["homeScore"], match["awayScore"])
        if match["status"] == "final":
            # A completed leg of an aggregate cup tie can have equal scores.
            # The common contract records the source result, not league rules.
            if None in scores:
                raise SnapshotError("INVALID_FINAL_SCORE")
        elif scores != (None, None):
            raise SnapshotError("SCORE_WITHOUT_FINAL_STATUS")
        if match["status"] == "scheduled" and match["startsAt"] is None:
            raise SnapshotError("SCHEDULED_TIME_REQUIRED")
    seen_standings = set()
    for table in data["standings"]:
        cid = table["competitionId"]
        if cid not in competitions or cid in seen_standings:
            raise SnapshotError("STANDINGS_COMPETITION_REFERENCE")
        seen_standings.add(cid)
        if table["sourceId"] is not None and table["sourceId"] not in indexes["sources"]:
            raise SnapshotError("STANDINGS_SOURCE_REFERENCE")
        if table["status"] != "available":
            if table["rows"]:
                raise SnapshotError("ROWS_WITHOUT_STANDINGS")
            continue
        if not table["rows"] or table["sourceId"] is None or table["sourceUrl"] is None:
            raise SnapshotError("STANDINGS_DATA_REQUIRED")
        row_teams, positions = set(), set()
        for row in table["rows"]:
            if row["teamId"] not in teams or row["teamId"] in row_teams or row["position"] in positions:
                raise SnapshotError("STANDINGS_ROW_REFERENCE")
            if row["played"] != row["wins"] + row["losses"]:
                raise SnapshotError("STANDINGS_RECORD_MISMATCH")
            row_teams.add(row["teamId"])
            positions.add(row["position"])
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*")
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--schema", action="store_true")
    args = parser.parse_args()
    if args.schema:
        print(json.dumps(SCHEMA, ensure_ascii=False, indent=2))
    for path in args.paths:
        validate_snapshot(json.loads(Path(path).read_text()), live_only=args.live)
        print(f"Valid snapshot: {path}")


if __name__ == "__main__":
    main()
