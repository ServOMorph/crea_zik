from pathlib import Path
from uuid import uuid4

import pytest

from crea_zik.cli import PROJECT_ROOT, load_project, save_project
from crea_zik.errors import RenderEngineUnavailableError
from crea_zik.engine import CsoundEngine
from pydantic import ValidationError

from crea_zik.models import (
    AdaptiveGraph,
    AdaptiveState,
    AdaptiveTransition,
    Artifact,
    EffectChain,
    Instrument,
    Patch,
    PatchKind,
    Project,
    QaReport,
    RenderJob,
    Score,
    ScoreEvent,
)
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


def test_project_schema_migrates_legacy_payload_and_normalizes_name() -> None:
    project = Project.model_validate({"name": "  Demo   project  ", "schemaVersion": 1})
    assert project.name == "Demo project"
    assert project.schema_version == 1
    assert project.patches == []


def test_project_rejects_schema_from_a_newer_application() -> None:
    with pytest.raises(ValidationError, match="newer than this application"):
        Project.model_validate({"name": "demo", "schema_version": 2})


def test_domain_models_validate_references_and_relative_artifacts() -> None:
    patch = Patch(name="click", kind=PatchKind.UI_CLICK, seed=4, duration_seconds=.12)
    instrument = Instrument(name="lead", patch_id=patch.id, seed=5)
    event = ScoreEvent(instrument_id=instrument.id, start_beats=0, duration_beats=1, midi_note=60, velocity=.8)
    score = Score(name="theme", seed=6, events=[event])
    state = AdaptiveState(name="exploration", score_id=score.id)
    graph = AdaptiveGraph(
        name="gameplay",
        seed=7,
        initial_state_id=state.id,
        states=[state],
        transitions=[AdaptiveTransition(source_state_id=state.id, target_state_id=state.id, condition="intensity < 0.5")],
    )
    artifact = Artifact(relative_path="artifacts/click.wav", spec_hash="0" * 64, engine="csound7")
    report = QaReport(artifact_id=artifact.id, profile="sfx", passed=True)
    project = Project(
        name="demo",
        patches=[patch],
        instruments=[instrument],
        effect_chains=[EffectChain(name="dry", seed=8)],
        scores=[score],
        adaptive_graphs=[graph],
        artifacts=[artifact],
        qa_reports=[report],
    )
    job = RenderJob(project_id=project.id, patch_id=patch.id)
    assert job.progress == 0
    with pytest.raises(ValueError):
        Artifact(relative_path="../outside.wav", spec_hash="0" * 64, engine="csound7")


def test_adaptive_graph_rejects_unknown_state_reference() -> None:
    with pytest.raises(ValueError):
        AdaptiveGraph(name="invalid", seed=1, initial_state_id=uuid4())


def test_save_project_rejects_external_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    root = tmp_path / "projects"
    root.mkdir()
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", root)
    with pytest.raises(ValueError):
        save_project(Project(name="demo"), tmp_path / "outside.json")


def test_csound_engine_reports_a_typed_error_when_the_binary_is_missing(tmp_path: Path) -> None:
    with pytest.raises(RenderEngineUnavailableError):
        CsoundEngine(executable=tmp_path / "missing-csound.exe")
