#!/usr/bin/env python3
"""Validate the shared product version across the monorepo."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SEMVER_PATTERN = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")


def read_json(relative_path: str) -> dict:
    with (ROOT / relative_path).open(encoding="utf-8") as file:
        return json.load(file)


def extract_one(relative_path: str, pattern: str, label: str) -> str:
    text = (ROOT / relative_path).read_text(encoding="utf-8")
    match = re.search(pattern, text, re.MULTILINE)
    if match is None:
        raise ValueError(f"{label}을(를) {relative_path}에서 찾을 수 없습니다.")
    return match.group(1)


def main() -> int:
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    errors: list[str] = []

    if SEMVER_PATTERN.fullmatch(version) is None:
        errors.append(f"VERSION 값 '{version}'은 MAJOR.MINOR.PATCH 형식이 아닙니다.")

    frontend_package = read_json("frontend/package.json")
    frontend_lock = read_json("frontend/package-lock.json")
    frontend_public_version = read_json("frontend/public/version.json")

    actual_versions = {
        "frontend/package.json": frontend_package.get("version"),
        "frontend/package-lock.json": frontend_lock.get("version"),
        "frontend/package-lock.json packages['']": frontend_lock.get("packages", {})
        .get("", {})
        .get("version"),
        "frontend/public/version.json": frontend_public_version.get("version"),
        "backend/build.gradle": extract_one(
            "backend/build.gradle", r"^version\s*=\s*'([^']+)'$", "version"
        ),
    }

    for path, actual in actual_versions.items():
        if actual != version:
            errors.append(f"{path}: 기대값 {version}, 실제값 {actual}")

    if errors:
        print("버전 검증에 실패했습니다:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"저장소 버전 {version} 동기화를 확인했습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
