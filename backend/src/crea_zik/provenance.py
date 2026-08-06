from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .errors import ProjectPathError
from .models import Patch, Composition

ENGINE_VERSION = "csound-7.0.0-beta.17"


def canonical_json(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def patch_hash(patch: Patch) -> str:
    payload = {"engine": ENGINE_VERSION, "patch": patch.model_dump(mode="json")}
    return hashlib.sha256(canonical_json(payload)).hexdigest()


def composition_hash(composition: Composition) -> str:
    payload = {"engine": ENGINE_VERSION, "composition": composition.model_dump(mode="json")}
    return hashlib.sha256(canonical_json(payload)).hexdigest()


def resolve_project_path(root: Path, *parts: str) -> Path:
    candidate = root.joinpath(*parts).resolve()
    if root.resolve() not in candidate.parents and candidate != root.resolve():
        raise ProjectPathError("Path escapes the authorized project root.")
    return candidate
