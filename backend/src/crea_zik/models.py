from __future__ import annotations

from copy import deepcopy
from enum import StrEnum
from pathlib import PurePosixPath
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


CURRENT_SCHEMA_VERSION = 1


class SchemaMigrationError(ValueError):
    pass


class PatchKind(StrEnum):
    UI_CLICK = "ui_click"
    MODAL_IMPACT = "modal_impact"
    ENGINE = "continuous_engine"


class JobState(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DomainModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IdentifiedModel(DomainModel):
    id: UUID = Field(default_factory=uuid4)


class SeededModel(IdentifiedModel):
    seed: int = Field(ge=0, le=2**63 - 1)


def _safe_name(value: str) -> str:
    normalized = " ".join(value.split())
    if not normalized:
        raise ValueError("name must not be blank")
    if any(part in normalized for part in ("/", "\\", "..")):
        raise ValueError("name must not contain a path segment")
    return normalized


def _relative_path(value: str) -> str:
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or value == ".":
        raise ValueError("path must be relative to its project")
    return path.as_posix()


class Patch(SeededModel):
    name: str = Field(min_length=1, max_length=80)
    kind: PatchKind
    duration_seconds: float = Field(gt=0, le=120)
    gain: float = Field(default=0.18, gt=0, le=1)

    _normalize_name = field_validator("name")(_safe_name)


class Instrument(SeededModel):
    name: str = Field(min_length=1, max_length=80)
    patch_id: UUID
    polyphony: int = Field(default=1, ge=1, le=128)
    parameters: dict[str, float] = Field(default_factory=dict)

    _normalize_name = field_validator("name")(_safe_name)


class Effect(IdentifiedModel):
    name: str = Field(min_length=1, max_length=80)
    kind: str = Field(min_length=1, max_length=80)
    parameters: dict[str, float] = Field(default_factory=dict)

    _normalize_name = field_validator("name")(_safe_name)
    _normalize_kind = field_validator("kind")(_safe_name)


class EffectChain(SeededModel):
    name: str = Field(min_length=1, max_length=80)
    effects: list[Effect] = Field(default_factory=list, max_length=32)

    _normalize_name = field_validator("name")(_safe_name)


class ScoreEvent(IdentifiedModel):
    instrument_id: UUID
    start_beats: float = Field(ge=0)
    duration_beats: float = Field(gt=0)
    midi_note: int = Field(ge=0, le=127)
    velocity: float = Field(gt=0, le=1)


class Score(SeededModel):
    name: str = Field(min_length=1, max_length=80)
    tempo_bpm: float = Field(default=120, ge=20, le=400)
    beats_per_bar: int = Field(default=4, ge=1, le=32)
    beat_unit: int = Field(default=4, ge=1, le=32)
    events: list[ScoreEvent] = Field(default_factory=list)

    _normalize_name = field_validator("name")(_safe_name)


class AdaptiveState(IdentifiedModel):
    name: str = Field(min_length=1, max_length=80)
    score_id: UUID | None = None

    _normalize_name = field_validator("name")(_safe_name)


class AdaptiveTransition(IdentifiedModel):
    source_state_id: UUID
    target_state_id: UUID
    condition: str = Field(min_length=1, max_length=120)
    quantization: str = Field(default="bar", pattern="^(immediate|beat|bar|end)$")


class AdaptiveGraph(SeededModel):
    name: str = Field(min_length=1, max_length=80)
    initial_state_id: UUID | None = None
    states: list[AdaptiveState] = Field(default_factory=list)
    transitions: list[AdaptiveTransition] = Field(default_factory=list)

    _normalize_name = field_validator("name")(_safe_name)

    @model_validator(mode="after")
    def validate_references(self) -> AdaptiveGraph:
        state_ids = {state.id for state in self.states}
        if len(state_ids) != len(self.states):
            raise ValueError("adaptive graph state ids must be unique")
        if self.initial_state_id is not None and self.initial_state_id not in state_ids:
            raise ValueError("initial_state_id must reference a state")
        for transition in self.transitions:
            if transition.source_state_id not in state_ids or transition.target_state_id not in state_ids:
                raise ValueError("adaptive transitions must reference states")
        return self


class Artifact(IdentifiedModel):
    project_id: UUID | None = None
    patch_id: UUID | None = None
    relative_path: str
    spec_hash: str = Field(pattern="^[0-9a-f]{64}$")
    engine: str = Field(min_length=1, max_length=80)
    sample_rate: int = Field(default=48_000, ge=8_000, le=192_000)

    _validate_path = field_validator("relative_path")(_relative_path)
    _normalize_engine = field_validator("engine")(_safe_name)


class QaReport(IdentifiedModel):
    artifact_id: UUID
    profile: str = Field(min_length=1, max_length=80)
    passed: bool
    metrics: dict[str, float] = Field(default_factory=dict)
    issues: list[str] = Field(default_factory=list)

    _normalize_profile = field_validator("profile")(_safe_name)


class RenderJob(IdentifiedModel):
    project_id: UUID
    patch_id: UUID
    state: JobState = JobState.QUEUED
    progress: int = Field(default=0, ge=0, le=100)
    error: str | None = None
    artifact_id: UUID | None = None


def migrate_project_payload(payload: dict[str, Any]) -> dict[str, Any]:
    data = deepcopy(payload)
    if "schemaVersion" in data and "schema_version" not in data:
        data["schema_version"] = data.pop("schemaVersion")
    version = data.get("schema_version", CURRENT_SCHEMA_VERSION)
    if not isinstance(version, int) or version < 1:
        raise SchemaMigrationError("schema_version must be a positive integer")
    if version > CURRENT_SCHEMA_VERSION:
        raise SchemaMigrationError("project schema is newer than this application")
    data["schema_version"] = CURRENT_SCHEMA_VERSION
    for key in ("patches", "instruments", "effect_chains", "scores", "adaptive_graphs", "artifacts", "qa_reports"):
        data.setdefault(key, [])
    return data


class Project(IdentifiedModel):
    name: str = Field(min_length=1, max_length=80)
    sample_rate: int = Field(default=48_000, ge=8_000, le=192_000)
    engine: str = Field(default="csound7", min_length=1, max_length=80)
    schema_version: int = Field(default=CURRENT_SCHEMA_VERSION, ge=1)
    patches: list[Patch] = Field(default_factory=list)
    instruments: list[Instrument] = Field(default_factory=list)
    effect_chains: list[EffectChain] = Field(default_factory=list)
    scores: list[Score] = Field(default_factory=list)
    adaptive_graphs: list[AdaptiveGraph] = Field(default_factory=list)
    artifacts: list[Artifact] = Field(default_factory=list)
    qa_reports: list[QaReport] = Field(default_factory=list)

    _normalize_name = field_validator("name")(_safe_name)
    _normalize_engine = field_validator("engine")(_safe_name)

    @model_validator(mode="before")
    @classmethod
    def migrate(cls, value: Any) -> Any:
        if isinstance(value, dict):
            return migrate_project_payload(value)
        return value
