from __future__ import annotations

from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PatchKind(StrEnum):
    UI_CLICK = "ui_click"
    MODAL_IMPACT = "modal_impact"
    ENGINE = "continuous_engine"


class Patch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID = Field(default_factory=uuid4)
    name: str = Field(min_length=1, max_length=80)
    kind: PatchKind
    seed: int = Field(ge=0, le=2**63 - 1)
    duration_seconds: float = Field(gt=0, le=120)
    gain: float = Field(default=0.18, gt=0, le=1)

    @field_validator("name")
    @classmethod
    def no_path_segments(cls, value: str) -> str:
        if any(part in value for part in ("/", "\\", "..")):
            raise ValueError("name must not contain a path segment")
        return value


class Project(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID = Field(default_factory=uuid4)
    name: str = Field(min_length=1, max_length=80)
    sample_rate: int = Field(default=48_000, ge=8_000, le=192_000)
    engine: str = "csound7"
    schema_version: int = Field(default=1, ge=1)
    patches: list[Patch] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def safe_project_name(cls, value: str) -> str:
        if any(part in value for part in ("/", "\\", "..")):
            raise ValueError("name must not contain a path segment")
        return value
