from pathlib import Path

import pytest

from crea_zik.cli import PROJECT_ROOT, load_project, save_project
from crea_zik.models import Patch, PatchKind, Project
from crea_zik.provenance import patch_hash, resolve_project_path


def test_hash_is_stable_for_same_spec() -> None:
    patch = Patch(name="click", kind=PatchKind.UI_CLICK, seed=42, duration_seconds=.12)
    assert patch_hash(patch) == patch_hash(patch)


def test_path_cannot_escape_project_root(tmp_path: Path) -> None:
    root = tmp_path / "projects"
    root.mkdir()
    with pytest.raises(ValueError):
        resolve_project_path(root, "..", "outside.json")


def test_load_project_rejects_external_path(tmp_path: Path) -> None:
    external = tmp_path / "project.json"
    external.write_text(Project(name="external").model_dump_json(), encoding="utf-8")
    with pytest.raises(ValueError):
        load_project(external)


def test_project_round_trip_in_authorized_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    root = tmp_path / "projects"
    root.mkdir()
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", root)
    project = Project(name="demo")
    path = root / str(project.id) / "project.json"
    save_project(project, path)
    assert load_project(path) == project
