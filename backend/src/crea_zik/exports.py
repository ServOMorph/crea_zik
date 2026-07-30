from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .errors import ExportArtifactMissingError
from .models import Patch, Project
from .provenance import ENGINE_VERSION, canonical_json, patch_hash, resolve_project_path

MANIFEST_SCHEMA_VERSION = 1


def _file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export_patch(project_root: Path, project: Project, patch: Patch) -> tuple[Path, Path]:
    source = resolve_project_path(project_root, str(project.id), "artifacts", f"{patch.id}.wav")
    if not source.is_file():
        raise ExportArtifactMissingError("Render the patch before exporting it.", {"patch_id": str(patch.id)})
    destination = resolve_project_path(project_root, str(project.id), "exports", f"{patch.id}.wav")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(source.read_bytes())
    manifest = {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "project_id": str(project.id),
        "patch_id": str(patch.id),
        "artifact": {
            "relative_path": destination.relative_to(project_root.resolve()).as_posix(),
            "sha256": _file_hash(destination),
            "bytes": destination.stat().st_size,
            "sample_rate": project.sample_rate,
        },
        "provenance": {"spec_hash": patch_hash(patch), "engine_version": ENGINE_VERSION},
    }
    manifest_path = destination.with_suffix(".manifest.json")
    manifest_path.write_bytes(canonical_json(manifest))
    return destination, manifest_path
