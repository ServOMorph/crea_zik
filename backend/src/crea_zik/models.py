from __future__ import annotations

from copy import deepcopy
from enum import StrEnum
from math import isfinite
from pathlib import PurePosixPath
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CURRENT_SCHEMA_VERSION = 3

PATTERN_DEFAULT_COLORS = (
    "#e0a458",
    "#7fb3d5",
    "#9bb87f",
    "#c98bb8",
    "#e58d7f",
    "#d5c76b",
)


class SchemaMigrationError(ValueError):
    pass


class PatchKind(StrEnum):
    UI_CLICK = "ui_click"
    MODAL_IMPACT = "modal_impact"
    ENGINE = "continuous_engine"
    WHOOSH = "whoosh"
    MECHANICAL_AMBIENCE = "mechanical_ambience"
    DRONE = "drone"


class JobState(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ErrorDetail(BaseModel):
    code: str = Field(pattern="^[a-z][a-z0-9_]{2,63}$")
    message: str = Field(min_length=1, max_length=240)
    details: dict[str, str] = Field(default_factory=dict)


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


def _validate_finite_json(value: Any) -> None:
    if isinstance(value, float) and not isfinite(value):
        raise ValueError("composition parameters must be finite")
    if isinstance(value, dict):
        for item in value.values():
            _validate_finite_json(item)
    if isinstance(value, list):
        for item in value:
            _validate_finite_json(item)


def _has_mixer_cycle(channels: dict[UUID, MixerChannel]) -> bool:
    visiting: set[UUID] = set()
    visited: set[UUID] = set()

    def visit(channel_id: UUID) -> bool:
        if channel_id in visiting:
            return True
        if channel_id in visited:
            return False
        visiting.add(channel_id)
        output = channels[channel_id].output
        if isinstance(output, UUID) and visit(output):
            return True
        visiting.remove(channel_id)
        visited.add(channel_id)
        return False

    return any(visit(channel_id) for channel_id in channels)


class Patch(SeededModel):
    name: str = Field(min_length=1, max_length=80)
    kind: PatchKind
    duration_seconds: float = Field(gt=0, le=120)
    gain: float = Field(default=0.18, gt=0, le=1)
    parameters: dict[str, float] = Field(default_factory=dict, max_length=32)
    tags: list[str] = Field(default_factory=list, max_length=16)
    notes: str = Field(default="", max_length=500)
    favorite: bool = False

    _normalize_name = field_validator("name")(_safe_name)

    @field_validator("parameters")
    @classmethod
    def validate_parameters(cls, values: dict[str, float]) -> dict[str, float]:
        if any(not key or not isfinite(value) for key, value in values.items()):
            raise ValueError("parameters must have non-empty names and finite values")
        return values

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, values: list[str]) -> list[str]:
        return [_safe_name(value) for value in values]


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


class NoteEvent(IdentifiedModel):
    start_beat: float = Field(ge=0, le=100_000)
    duration_beats: float = Field(gt=0, le=10_000)
    midi_note: int = Field(ge=0, le=127)
    velocity: float = Field(gt=0, le=1)
    probability: float = Field(default=1, gt=0, le=1)
    micro_timing_beats: float = Field(default=0, ge=-1, le=1)
    pan: float = Field(default=0, ge=-1, le=1)


class InstrumentPreset(DomainModel):
    parameters: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def wrap_parameters(cls, value: Any) -> Any:
        if isinstance(value, dict) and set(value) != {"parameters"}:
            return {"parameters": value}
        return value

    @field_validator("parameters")
    @classmethod
    def validate_parameters(cls, values: dict[str, Any]) -> dict[str, Any]:
        _validate_finite_json(values)
        return values


class EffectInstance(IdentifiedModel):
    kind: str = Field(min_length=1, max_length=80)
    bypass: bool = False
    parameters: dict[str, Any] = Field(default_factory=dict)

    _normalize_kind = field_validator("kind")(_safe_name)

    @field_validator("parameters")
    @classmethod
    def validate_parameters(cls, values: dict[str, Any]) -> dict[str, Any]:
        _validate_finite_json(values)
        return values


class Track(IdentifiedModel):
    name: str = Field(min_length=1, max_length=80)
    kind: Literal["drums", "bass", "pad", "arp", "lead", "audio", "midi"]
    gain: float = Field(default=1, ge=0, le=2)
    pan: float = Field(default=0, ge=-1, le=1)
    instrument: InstrumentPreset = Field(default_factory=InstrumentPreset)
    processors: list[EffectInstance] = Field(default_factory=list, max_length=32)

    _normalize_name = field_validator("name")(_safe_name)


class Pattern(IdentifiedModel):
    track_id: UUID
    events: list[NoteEvent] = Field(default_factory=list, max_length=20_000)
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-f]{6}$")
    length_beats: float | None = Field(default=None, gt=0, le=100_000)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return None if value is None else _safe_name(value)


class Clip(IdentifiedModel):
    pattern_id: UUID
    start_beat: float = Field(ge=0, le=100_000)
    length_beats: float = Field(gt=0, le=100_000)
    repeat_count: int = Field(default=1, ge=1, le=10_000)
    transposition: int = Field(default=0, ge=-48, le=48)


class AutomationPoint(DomainModel):
    beat: float = Field(ge=0, le=100_000)
    value: float
    interpolation: Literal["step", "linear"] = "linear"

    @field_validator("value")
    @classmethod
    def validate_value(cls, value: float) -> float:
        if not isfinite(value):
            raise ValueError("automation values must be finite")
        return value


class AutomationLane(IdentifiedModel):
    target: str = Field(pattern=r"^(track|master)\.[0-9a-f-]+\.(gain|pan|parameter\.[a-z][a-z0-9_]*)$")
    points: list[AutomationPoint] = Field(min_length=1, max_length=20_000)

    @model_validator(mode="after")
    def validate_points(self) -> AutomationLane:
        beats = [point.beat for point in self.points]
        if beats != sorted(beats) or len(beats) != len(set(beats)):
            raise ValueError("automation points must be unique and ordered")
        return self


class MixerChannel(IdentifiedModel):
    track_id: UUID | None = None
    gain: float = Field(default=1, ge=0, le=2)
    pan: float = Field(default=0, ge=-1, le=1)
    mute: bool = False
    solo: bool = False
    output: UUID | Literal["master"] = "master"
    sends: dict[UUID, float] = Field(default_factory=dict)
    effects: list[EffectInstance] = Field(default_factory=list, max_length=32)

    @field_validator("sends")
    @classmethod
    def validate_sends(cls, values: dict[UUID, float]) -> dict[UUID, float]:
        if any(not isfinite(value) or value < 0 or value > 1 for value in values.values()):
            raise ValueError("send gains must be finite values from 0 to 1")
        return values


class RenderSettings(DomainModel):
    duration_seconds: float = Field(gt=0, le=7_200)
    format: Literal["wav_pcm24", "wav_pcm16", "wav_float32"] = "wav_pcm24"
    channels: Literal[2] = 2
    stems: bool = True


class Composition(SeededModel):
    schema_version: Literal[2, 3] = 3
    revision: int = Field(default=0, ge=0)
    title: str = Field(min_length=1, max_length=160)
    sample_rate: Literal[44_100, 48_000, 88_200, 96_000] = 48_000
    tempo_bpm: float = Field(ge=20, le=400)
    time_signature: tuple[int, Literal[1, 2, 4, 8, 16]] = (4, 4)
    tracks: list[Track] = Field(min_length=1, max_length=256)
    patterns: list[Pattern] = Field(default_factory=list, max_length=4_096)
    clips: list[Clip] = Field(default_factory=list, max_length=16_384)
    master_channel: MixerChannel = Field(default_factory=MixerChannel)
    mixer_channels: list[MixerChannel] = Field(default_factory=list, max_length=512)
    automation_lanes: list[AutomationLane] = Field(default_factory=list, max_length=4_096)
    render_settings: RenderSettings

    _normalize_title = field_validator("title")(_safe_name)

    @field_validator("time_signature")
    @classmethod
    def validate_time_signature(cls, value: tuple[int, int]) -> tuple[int, int]:
        if not 1 <= value[0] <= 32:
            raise ValueError("time signature numerator must be from 1 to 32")
        return value

    @model_validator(mode="after")
    def validate_references(self) -> Composition:
        track_ids = {track.id for track in self.tracks}
        pattern_ids = {pattern.id for pattern in self.patterns}
        if len(track_ids) != len(self.tracks) or len(pattern_ids) != len(self.patterns):
            raise ValueError("composition identifiers must be unique")
        if any(pattern.track_id not in track_ids for pattern in self.patterns):
            raise ValueError("patterns must reference a track")
        if any(clip.pattern_id not in pattern_ids for clip in self.clips):
            raise ValueError("clips must reference a pattern")
        channels_by_id = {channel.id: channel for channel in self.mixer_channels}
        if len(channels_by_id) != len(self.mixer_channels):
            raise ValueError("mixer channel identifiers must be unique")
        if any(channel.track_id is not None and channel.track_id not in track_ids for channel in self.mixer_channels):
            raise ValueError("mixer channels must reference a track")
        if any(isinstance(channel.output, UUID) and channel.output not in channels_by_id for channel in self.mixer_channels):
            raise ValueError("mixer outputs must reference a channel or master")
        if any(target not in channels_by_id for channel in self.mixer_channels for target in channel.sends):
            raise ValueError("mixer sends must reference a channel")
        if _has_mixer_cycle(channels_by_id):
            raise ValueError("mixer routing must not contain a cycle")
        for lane in self.automation_lanes:
            scope, identifier, _ = lane.target.split(".", 2)
            if scope == "track" and UUID(identifier) not in track_ids:
                raise ValueError("automation target must reference a track")
        return self


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


class ProposalOperation(DomainModel):
    op: Literal["replace"]
    patch_id: UUID
    path: str = Field(pattern=r"^(gain|duration_seconds|favorite|notes|tags|parameters\.[a-z][a-z0-9_]*)$")
    value: Any


class IntentProposal(DomainModel):
    intent: str = Field(min_length=1, max_length=240)
    rationale: str = Field(default="", max_length=300)
    expected_impacts: list[str] = Field(default_factory=list, max_length=5)
    operations: list[ProposalOperation] = Field(min_length=1, max_length=16)


class IntentDecision(StrEnum):
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class IntentRecord(IdentifiedModel):
    provider: str = Field(default="ollama", min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=120)
    project_schema_version: int = Field(ge=1)
    decision: IntentDecision
    proposal: IntentProposal

    _normalize_provider = field_validator("provider")(_safe_name)
    _normalize_model = field_validator("model")(_safe_name)


class RenderJob(IdentifiedModel):
    project_id: UUID
    patch_id: UUID
    state: JobState = JobState.QUEUED
    progress: int = Field(default=0, ge=0, le=100)
    error: ErrorDetail | None = None
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
    while version < CURRENT_SCHEMA_VERSION:
        if version == 1:
            data.setdefault("compositions", [])
            version = 2
        elif version == 2:
            for composition in data.get("compositions", []):
                for index, pattern in enumerate(composition.get("patterns", [])):
                    pattern.setdefault("name", f"Pattern {index + 1}")
                    pattern.setdefault(
                        "color",
                        PATTERN_DEFAULT_COLORS[index % len(PATTERN_DEFAULT_COLORS)],
                    )
                composition["schema_version"] = 3
            version = 3
        else:
            raise SchemaMigrationError(f"no migration is available from schema version {version}")
    data["schema_version"] = version
    for key in (
        "patches",
        "instruments",
        "effect_chains",
        "scores",
        "adaptive_graphs",
        "artifacts",
        "qa_reports",
        "intent_history",
        "compositions",
    ):
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
    intent_history: list[IntentRecord] = Field(default_factory=list, max_length=200)
    compositions: list[Composition] = Field(default_factory=list, max_length=128)

    _normalize_name = field_validator("name")(_safe_name)
    _normalize_engine = field_validator("engine")(_safe_name)

    @model_validator(mode="before")
    @classmethod
    def migrate(cls, value: Any) -> Any:
        if isinstance(value, dict):
            return migrate_project_payload(value)
        return value
