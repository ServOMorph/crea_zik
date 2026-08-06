from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, cast
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from fastapi import FastAPI, HTTPException, Request, status
from fastapi import Path as ApiPath
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .adaptive import GameplayEvent, simulate_adaptive_graph
from .audio_info import wav_info
from .cli import PROJECT_ROOT, load_project, replace_composition, save_project
from .composer import render_score
from .composition_dsp import synthesize, write_wav
from .compositions import copy_composition
from .errors import (
    CompositionNotFoundError,
    CompositionRevisionConflictError,
    CreaZikError,
    ExportArtifactMissingError,
    PatchNotFoundError,
    error_detail,
)
from .exports import export_patch
from .gallery import composition_example, composition_examples, examples
from .instrument_registry import registry_payload
from .intent import IntentProposal, preview_proposal
from .jobs import JobManager, JobState, RenderJob
from .models import (
    AdaptiveGraph,
    Artifact,
    AutomationLane,
    Clip,
    Composition,
    ErrorDetail,
    Instrument,
    IntentDecision,
    IntentRecord,
    MixerChannel,
    Patch,
    Pattern,
    Project,
    QaReport,
    Score,
    Track,
)
from .ollama import OllamaProposalError, generate_proposal
from .plugins import list_plugin_ids, load_manifest, render_plugin, resolve_params
from .provenance import patch_hash, resolve_project_path
from .qa import evaluate_wav
from .variants import DEFAULT_RANGES, vary_patch

app = FastAPI(title="Crea Zik", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
PROJECT_ROOT.mkdir(parents=True, exist_ok=True)
app.mount("/projects", StaticFiles(directory=PROJECT_ROOT), name="projects")
jobs = JobManager(PROJECT_ROOT)


class CreateProject(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class JobResponse(BaseModel):
    id: UUID
    state: JobState
    progress: int
    error: ErrorDetail | None = None
    wav: str | None = None
    artifacts: dict[str, str] = Field(default_factory=dict)
    composition_id: UUID | None = None
    composition_revision: int | None = None


class ExportResponse(BaseModel):
    wav: str
    manifest: str


class ArtifactResponse(BaseModel):
    wav: str
    sha256: str
    duration_seconds: float
    peak: float
    dc_offset: float
    is_clipping: bool
    sample_rate: int
    channels: int


class ParameterRange(BaseModel):
    minimum: float = Field(ge=-10_000, le=10_000)
    maximum: float = Field(ge=-10_000, le=10_000)


class VariantRequest(BaseModel):
    count: int = Field(default=10, ge=1, le=20)
    locked_parameters: set[str] = Field(default_factory=set)
    ranges: dict[str, ParameterRange] = Field(default_factory=dict)


class PatchUpdate(BaseModel):
    tags: list[str] | None = Field(default=None, max_length=16)
    notes: str | None = Field(default=None, max_length=500)
    favorite: bool | None = None


class ScoreRenderResponse(BaseModel):
    mix: str
    stems: dict[str, str]
    frame_count: int


class CompositionCreate(BaseModel):
    example_id: UUID


class CompositionSave(BaseModel):
    expected_revision: int = Field(ge=0)
    composition: Composition


class CompositionRenderRequest(BaseModel):
    track_ids: set[UUID] | None = None
    start_beat: float = Field(default=0, ge=0)
    end_beat: float | None = Field(default=None, gt=0)


class GameplayEventRequest(BaseModel):
    at_beats: float = Field(ge=0)
    values: dict[str, float]


class AdaptiveSimulationRequest(BaseModel):
    events: list[GameplayEventRequest]
    beats_per_bar: int = Field(default=4, ge=1, le=32)


class TransitionDecisionResponse(BaseModel):
    source_state_id: UUID
    target_state_id: UUID
    scheduled_beats: float
    condition: str


class AcceptedProposal(BaseModel):
    accepted: bool = Field(default=False)
    proposal: IntentProposal


class IntentRequest(BaseModel):
    intent: str = Field(min_length=1, max_length=240)


class QaRequest(BaseModel):
    profile: str = Field(default="sfx", min_length=1, max_length=80)
    loop: bool = False


class PluginSummary(BaseModel):
    plugin_id: str
    name: str
    version: str
    presets: list[str]


class PluginRenderRequest(BaseModel):
    preset: str = Field(min_length=1)
    overrides: dict[str, float | int | bool | str] = Field(default_factory=dict)
    velocity: float = Field(default=1.0, ge=0.0, le=1.0)


@app.exception_handler(CreaZikError)
async def crea_zik_error_handler(_: Request, error: CreaZikError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": error_detail(error).model_dump()},
    )


@app.exception_handler(CompositionRevisionConflictError)
async def composition_revision_conflict_handler(
    _: Request, error: CompositionRevisionConflictError
):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": error_detail(error).model_dump()},
    )


def job_response(job: RenderJob) -> JobResponse:
    return JobResponse(
        id=job.id,
        state=job.state,
        progress=job.progress,
        error=job.error,
        wav=job.wav,
        artifacts=job.artifacts,
        composition_id=job.composition_id,
        composition_revision=job.composition_revision,
    )


def project_path(project_id: UUID) -> Path:
    return resolve_project_path(PROJECT_ROOT, str(project_id), "project.json")


def get_project(project_id: UUID) -> Project:
    path = project_path(project_id)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="project not found"
        )
    return load_project(path)


def get_patch(project: Project, patch_id: UUID) -> Patch:
    patch = next((item for item in project.patches if item.id == patch_id), None)
    if patch is None:
        raise PatchNotFoundError("patch not found")
    return patch


def get_composition(project: Project, composition_id: UUID) -> Composition:
    composition = next(
        (item for item in project.compositions if item.id == composition_id), None
    )
    if composition is None:
        raise CompositionNotFoundError("composition not found")
    return composition


def composition_render_directory(
    project: Project, composition_id: UUID, revision: int
) -> Path:
    get_composition(project, composition_id)
    return resolve_project_path(
        PROJECT_ROOT,
        str(project.id),
        "compositions",
        str(composition_id),
        f"revision-{revision}",
    )


def record_proposal_decision(
    project: Project, proposal: IntentProposal, decision: IntentDecision
) -> None:
    project.intent_history.append(
        IntentRecord(
            model=os.environ.get("OLLAMA_MODEL", "qwen2.5:7b"),
            project_schema_version=project.schema_version,
            decision=decision,
            proposal=proposal,
        )
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "csound7"}


@app.get("/api/instrument-registry")
def read_instrument_registry() -> dict[str, object]:
    return registry_payload()


class InstrumentPreviewRequest(BaseModel):
    track_id: UUID
    midi_note: int = Field(default=60, ge=0, le=127)
    parameters: dict[str, Any] | None = None


@app.get("/api/projects", response_model=list[Project])
def list_projects() -> list[Project]:
    if not PROJECT_ROOT.exists():
        return []
    return [load_project(path) for path in PROJECT_ROOT.glob("*/project.json")]


@app.get("/api/projects/{project_id}", response_model=Project)
def read_project(project_id: UUID) -> Project:
    return get_project(project_id)


@app.get("/api/gallery", response_model=list[Patch])
def gallery() -> list[Patch]:
    return examples()


@app.get("/api/composition-gallery", response_model=list[Composition])
def composition_gallery() -> list[Composition]:
    return composition_examples()


@app.get(
    "/api/projects/{project_id}/compositions/{composition_id}",
    response_model=Composition,
)
def read_composition(project_id: UUID, composition_id: UUID) -> Composition:
    return get_composition(get_project(project_id), composition_id)


@app.get(
    "/api/projects/{project_id}/compositions/{composition_id}/tracks",
    response_model=list[Track],
)
def read_composition_tracks(project_id: UUID, composition_id: UUID) -> list[Track]:
    return get_composition(get_project(project_id), composition_id).tracks


@app.get(
    "/api/projects/{project_id}/compositions/{composition_id}/patterns",
    response_model=list[Pattern],
)
def read_composition_patterns(project_id: UUID, composition_id: UUID) -> list[Pattern]:
    return get_composition(get_project(project_id), composition_id).patterns


@app.get(
    "/api/projects/{project_id}/compositions/{composition_id}/clips",
    response_model=list[Clip],
)
def read_composition_clips(project_id: UUID, composition_id: UUID) -> list[Clip]:
    return get_composition(get_project(project_id), composition_id).clips


@app.get(
    "/api/projects/{project_id}/compositions/{composition_id}/automation",
    response_model=list[AutomationLane],
)
def read_composition_automation(
    project_id: UUID, composition_id: UUID
) -> list[AutomationLane]:
    return get_composition(get_project(project_id), composition_id).automation_lanes


@app.get(
    "/api/projects/{project_id}/compositions/{composition_id}/mixer",
    response_model=list[MixerChannel],
)
def read_composition_mixer(
    project_id: UUID, composition_id: UUID
) -> list[MixerChannel]:
    return get_composition(get_project(project_id), composition_id).mixer_channels


@app.get(
    "/api/projects/{project_id}/compositions/{composition_id}/master",
    response_model=MixerChannel,
)
def read_composition_master(project_id: UUID, composition_id: UUID) -> MixerChannel:
    return get_composition(get_project(project_id), composition_id).master_channel


@app.post("/api/projects", response_model=Project, status_code=status.HTTP_201_CREATED)
def create_project(payload: CreateProject) -> Project:
    project = Project(name=payload.name)
    save_project(project, project_path(project.id))
    return project


@app.post(
    "/api/projects/{project_id}/compositions",
    response_model=Composition,
    status_code=status.HTTP_201_CREATED,
)
def create_composition(project_id: UUID, payload: CompositionCreate) -> Composition:
    project = get_project(project_id)
    source = composition_example(payload.example_id)
    if source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="composition gallery example not found",
        )
    composition = copy_composition(source)
    project.compositions.append(composition)
    save_project(project, project_path(project.id))
    return composition


@app.put(
    "/api/projects/{project_id}/compositions/{composition_id}",
    response_model=Composition,
)
def save_composition(
    project_id: UUID, composition_id: UUID, payload: CompositionSave
) -> Composition:
    return replace_composition(
        project_path(project_id),
        composition_id,
        payload.expected_revision,
        payload.composition,
    )


@app.post("/api/projects/{project_id}/patches", response_model=Project)
def add_patch(project_id: UUID, patch: Patch) -> Project:
    project = get_project(project_id)
    project.patches.append(patch)
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/proposals/preview", response_model=Project)
def preview_intent_proposal(project_id: UUID, proposal: IntentProposal) -> Project:
    return preview_proposal(get_project(project_id), proposal)


@app.post(
    "/api/projects/{project_id}/proposals/generate", response_model=IntentProposal
)
def generate_intent_proposal(
    project_id: UUID, request: IntentRequest
) -> IntentProposal:
    try:
        return generate_proposal(get_project(project_id), request.intent)
    except OllamaProposalError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error


@app.post("/api/projects/{project_id}/proposals/apply", response_model=Project)
def apply_intent_proposal(project_id: UUID, request: AcceptedProposal) -> Project:
    if not request.accepted:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="proposal must be explicitly accepted",
        )
    project = preview_proposal(get_project(project_id), request.proposal)
    record_proposal_decision(project, request.proposal, IntentDecision.ACCEPTED)
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/proposals/reject", response_model=Project)
def reject_intent_proposal(project_id: UUID, request: IntentProposal) -> Project:
    project = get_project(project_id)
    record_proposal_decision(project, request, IntentDecision.REJECTED)
    save_project(project, project_path(project.id))
    return project


@app.get(
    "/api/projects/{project_id}/proposals/history", response_model=list[IntentRecord]
)
def list_intent_history(project_id: UUID) -> list[IntentRecord]:
    return get_project(project_id).intent_history


@app.patch("/api/projects/{project_id}/patches/{patch_id}", response_model=Project)
def update_patch(project_id: UUID, patch_id: UUID, update: PatchUpdate) -> Project:
    project = get_project(project_id)
    index = next(
        (index for index, item in enumerate(project.patches) if item.id == patch_id),
        None,
    )
    if index is None:
        raise PatchNotFoundError("patch not found")
    project.patches[index] = Patch.model_validate(
        project.patches[index].model_dump() | update.model_dump(exclude_none=True)
    )
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/instruments", response_model=Project)
def add_instrument(project_id: UUID, instrument: Instrument) -> Project:
    project = get_project(project_id)
    if instrument.patch_id not in {patch.id for patch in project.patches}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="instrument patch not found",
        )
    project.instruments.append(instrument)
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/scores", response_model=Project)
def add_score(project_id: UUID, score: Score) -> Project:
    project = get_project(project_id)
    project.scores.append(score)
    save_project(project, project_path(project.id))
    return project


@app.post(
    "/api/projects/{project_id}/scores/{score_id}/render",
    response_model=ScoreRenderResponse,
)
def render_project_score(project_id: UUID, score_id: UUID) -> ScoreRenderResponse:
    project = get_project(project_id)
    score = next((item for item in project.scores if item.id == score_id), None)
    if score is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="score not found"
        )
    destination = resolve_project_path(
        PROJECT_ROOT, str(project.id), "scores", str(score.id)
    )
    rendered = render_score(
        score, project.instruments, destination, project.sample_rate
    )
    relative = lambda path: (
        path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
    )
    return ScoreRenderResponse(
        mix=relative(rendered.mix_path),
        stems={
            instrument_id: relative(path)
            for instrument_id, path in rendered.stem_paths.items()
        },
        frame_count=rendered.frame_count,
    )


@app.post(
    "/api/projects/{project_id}/compositions/{composition_id}/render",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def render_project_composition(
    project_id: UUID,
    composition_id: UUID,
    request: CompositionRenderRequest | None = None,
) -> JobResponse:
    composition = get_composition(get_project(project_id), composition_id)
    request = request or CompositionRenderRequest()
    if request.track_ids is not None and not request.track_ids <= {
        track.id for track in composition.tracks
    }:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="unknown composition track",
        )
    job = jobs.submit_composition(
        project_id,
        composition,
        track_ids=request.track_ids,
        start_beat=request.start_beat,
        end_beat=request.end_beat,
    )
    return job_response(job)


@app.get(
    "/api/projects/{project_id}/compositions/{composition_id}/renders/{revision}/artifact",
    response_model=ArtifactResponse,
)
def read_composition_artifact(
    project_id: UUID, composition_id: UUID, revision: int = ApiPath(ge=0)
) -> ArtifactResponse:
    project = get_project(project_id)
    path = composition_render_directory(project, composition_id, revision) / "mix.wav"
    if not path.is_file():
        raise ExportArtifactMissingError(
            "Render the composition before reading its artifact.",
            {"composition_id": str(composition_id), "revision": str(revision)},
        )
    payload = wav_info(path)
    payload["wav"] = path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
    return ArtifactResponse.model_validate(payload)


@app.get(
    "/api/projects/{project_id}/compositions/{composition_id}/renders/{revision}/manifest"
)
def read_composition_manifest(
    project_id: UUID, composition_id: UUID, revision: int = ApiPath(ge=0)
) -> dict[str, object]:
    project = get_project(project_id)
    path = (
        composition_render_directory(project, composition_id, revision)
        / "manifest.json"
    )
    if not path.is_file():
        raise ExportArtifactMissingError(
            "Render the composition before reading its manifest.",
            {"composition_id": str(composition_id), "revision": str(revision)},
        )
    return json.loads(path.read_text(encoding="utf-8"))


@app.post(
    "/api/projects/{project_id}/compositions/{composition_id}/renders/{revision}/analyze",
    response_model=QaReport,
)
def analyze_composition_render(
    project_id: UUID,
    composition_id: UUID,
    revision: int = ApiPath(ge=0),
    request: QaRequest | None = None,
) -> QaReport:
    project = get_project(project_id)
    directory = composition_render_directory(project, composition_id, revision)
    mix_path = directory / "mix.wav"
    if not mix_path.is_file():
        raise ExportArtifactMissingError(
            "Render the composition before analyzing it.",
            {"composition_id": str(composition_id), "revision": str(revision)},
        )
    request = request or QaRequest(profile="music")
    report = evaluate_wav(
        uuid5(NAMESPACE_URL, f"crea-zik:{project_id}:{composition_id}:{revision}"),
        mix_path,
        request.profile,
        request.loop,
    )
    (directory / "qa.json").write_text(
        report.model_dump_json(indent=2), encoding="utf-8"
    )
    return report


@app.get(
    "/api/projects/{project_id}/compositions/{composition_id}/renders/{revision}/qa",
    response_model=QaReport,
)
def read_composition_qa(
    project_id: UUID, composition_id: UUID, revision: int = ApiPath(ge=0)
) -> QaReport:
    project = get_project(project_id)
    path = composition_render_directory(project, composition_id, revision) / "qa.json"
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="composition QA report not found",
        )
    return QaReport.model_validate_json(path.read_text(encoding="utf-8"))


@app.post(
    "/api/projects/{project_id}/compositions/{composition_id}/instrument-preview",
    response_model=ArtifactResponse,
)
def preview_composition_instrument(
    project_id: UUID,
    composition_id: UUID,
    request: InstrumentPreviewRequest,
) -> ArtifactResponse:
    project = get_project(project_id)
    composition = get_composition(project, composition_id)
    track = next(
        (item for item in composition.tracks if item.id == request.track_id), None
    )
    if track is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="unknown composition track",
        )
    audio = synthesize(
        track_kind=track.kind,
        midi_note=request.midi_note,
        duration_seconds=1.5,
        amplitude=0.8,
        parameters=request.parameters if request.parameters is not None else track.instrument.parameters,
        sample_rate=composition.sample_rate,
        seed=composition.seed,
    )
    path = resolve_project_path(
        PROJECT_ROOT,
        str(project.id),
        "compositions",
        str(composition_id),
        "previews",
        f"instrument-{track.id}.wav",
    )
    write_wav(path, audio, composition.sample_rate, "wav_pcm24")
    payload = wav_info(path)
    payload["wav"] = path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
    return ArtifactResponse.model_validate(payload)


@app.post("/api/projects/{project_id}/adaptive-graphs", response_model=Project)
def add_adaptive_graph(project_id: UUID, graph: AdaptiveGraph) -> Project:
    project = get_project(project_id)
    project.adaptive_graphs.append(graph)
    save_project(project, project_path(project.id))
    return project


@app.post(
    "/api/projects/{project_id}/adaptive-graphs/{graph_id}/simulate",
    response_model=list[TransitionDecisionResponse],
)
def simulate_project_adaptive_graph(
    project_id: UUID,
    graph_id: UUID,
    request: AdaptiveSimulationRequest,
) -> list[TransitionDecisionResponse]:
    project = get_project(project_id)
    graph = next(
        (item for item in project.adaptive_graphs if item.id == graph_id), None
    )
    if graph is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="adaptive graph not found"
        )
    decisions = simulate_adaptive_graph(
        graph,
        [
            GameplayEvent(at_beats=event.at_beats, values=event.values)
            for event in request.events
        ],
        request.beats_per_bar,
    )
    return [
        TransitionDecisionResponse.model_validate(decision, from_attributes=True)
        for decision in decisions
    ]


@app.post("/api/projects/{project_id}/gallery/{example_id}", response_model=Project)
def copy_gallery_example(project_id: UUID, example_id: UUID) -> Project:
    project = get_project(project_id)
    source = next((item for item in examples() if item.id == example_id), None)
    if source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="gallery example not found"
        )
    copy = source.model_copy(update={"id": uuid4()})
    project.patches.append(copy)
    save_project(project, project_path(project.id))
    return project


@app.post(
    "/api/projects/{project_id}/composition-gallery/{example_id}",
    response_model=Project,
)
def copy_composition_gallery_example(project_id: UUID, example_id: UUID) -> Project:
    project = get_project(project_id)
    source = composition_example(example_id)
    if source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="composition gallery example not found",
        )
    project.compositions.append(copy_composition(source))
    save_project(project, project_path(project.id))
    return project


@app.post(
    "/api/projects/{project_id}/patches/{patch_id}/variants", response_model=Project
)
def create_variants(
    project_id: UUID, patch_id: UUID, request: VariantRequest | None = None
) -> Project:
    request = request or VariantRequest()
    project = get_project(project_id)
    source = next((item for item in project.patches if item.id == patch_id), None)
    if source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="patch not found"
        )
    existing_seeds = {item.seed for item in project.patches}
    ranges = {
        name: (interval.minimum, interval.maximum)
        for name, interval in request.ranges.items()
        if interval.minimum <= interval.maximum
    }
    ranges = ranges or DEFAULT_RANGES
    template = source
    for offset in range(1, request.count + 1):
        seed = template.seed + offset
        while seed in existing_seeds:
            seed += request.count
        existing_seeds.add(seed)
        source = vary_patch(template, seed, request.locked_parameters, ranges)
        project.patches.append(
            source.model_copy(
                update={
                    "id": uuid4(),
                    "name": f"{source.name} · variante {offset}",
                    "seed": seed,
                }
            )
        )
    save_project(project, project_path(project.id))
    return project


@app.post(
    "/api/projects/{project_id}/patches/{patch_id}/render",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def render_patch(project_id: UUID, patch_id: UUID) -> JobResponse:
    project = get_project(project_id)
    patch = get_patch(project, patch_id)
    return job_response(jobs.submit(project.id, patch))


@app.get(
    "/api/projects/{project_id}/patches/{patch_id}/artifact",
    response_model=ArtifactResponse,
)
def read_artifact(project_id: UUID, patch_id: UUID) -> ArtifactResponse:
    project = get_project(project_id)
    patch = get_patch(project, patch_id)
    path = resolve_project_path(
        PROJECT_ROOT, str(project.id), "artifacts", f"{patch.id}.wav"
    )
    if not path.is_file():
        raise ExportArtifactMissingError(
            "Render the patch before reading its artifact.", {"patch_id": str(patch.id)}
        )
    payload = wav_info(path)
    payload["wav"] = path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
    return ArtifactResponse.model_validate(payload)


@app.post(
    "/api/projects/{project_id}/patches/{patch_id}/analyze", response_model=QaReport
)
def analyze_patch(
    project_id: UUID, patch_id: UUID, request: QaRequest | None = None
) -> QaReport:
    request = request or QaRequest()
    project = get_project(project_id)
    patch = get_patch(project, patch_id)
    path = resolve_project_path(
        PROJECT_ROOT, str(project.id), "artifacts", f"{patch.id}.wav"
    )
    if not path.is_file():
        raise ExportArtifactMissingError(
            "Render the patch before analyzing it.", {"patch_id": str(patch.id)}
        )
    artifact = next(
        (item for item in project.artifacts if item.patch_id == patch.id), None
    )
    if artifact is None:
        artifact = Artifact(
            project_id=project.id,
            patch_id=patch.id,
            relative_path=path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix(),
            spec_hash=patch_hash(patch),
            engine=project.engine,
            sample_rate=project.sample_rate,
        )
        project.artifacts.append(artifact)
    report = evaluate_wav(artifact.id, path, request.profile, request.loop)
    project.qa_reports = [
        item for item in project.qa_reports if item.artifact_id != artifact.id
    ] + [report]
    save_project(project, project_path(project.id))
    return report


@app.post(
    "/api/projects/{project_id}/patches/{patch_id}/export",
    response_model=ExportResponse,
)
def export_project_patch(project_id: UUID, patch_id: UUID) -> ExportResponse:
    project = get_project(project_id)
    patch = get_patch(project, patch_id)
    destination, manifest = export_patch(PROJECT_ROOT, project, patch)
    return ExportResponse(
        wav=destination.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix(),
        manifest=manifest.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix(),
    )


@app.get("/api/plugins", response_model=list[PluginSummary])
def list_plugins() -> list[PluginSummary]:
    summaries = []
    for plugin_id in list_plugin_ids():
        manifest = load_manifest(plugin_id)
        summaries.append(
            PluginSummary(
                plugin_id=manifest["plugin_id"],
                name=manifest["name"],
                version=manifest["version"],
                presets=manifest["presets"],
            )
        )
    return summaries


@app.get("/api/plugins/{plugin_id}/manifest")
def read_plugin_manifest(plugin_id: str) -> dict[str, object]:
    try:
        return load_manifest(plugin_id)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error


@app.get("/api/plugins/{plugin_id}/presets/{preset}")
def read_plugin_preset(plugin_id: str, preset: str) -> dict[str, object]:
    try:
        load_manifest(plugin_id)
        return resolve_params(plugin_id, preset, {})
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error


@app.post("/api/plugins/{plugin_id}/render", response_model=ArtifactResponse)
def render_plugin_endpoint(
    plugin_id: str, request: PluginRenderRequest
) -> ArtifactResponse:
    try:
        load_manifest(plugin_id)
        params = resolve_params(
            plugin_id, request.preset, cast(dict[str, object], request.overrides)
        )
        audio, sample_rate = render_plugin(plugin_id, params, request.velocity)
    except ValueError as error:
        message = str(error)
        code = (
            status.HTTP_404_NOT_FOUND
            if "inconnu" in message
            else status.HTTP_422_UNPROCESSABLE_CONTENT
        )
        raise HTTPException(status_code=code, detail=message) from error
    path = resolve_project_path(PROJECT_ROOT, "plugins", plugin_id, f"{uuid4()}.wav")
    write_wav(path, audio, sample_rate, "wav_pcm24")
    payload = wav_info(path)
    payload["wav"] = path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
    return ArtifactResponse.model_validate(payload)


@app.get("/api/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID) -> JobResponse:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="job not found"
        )
    return job_response(job)


@app.post("/api/jobs/{job_id}/cancel", response_model=JobResponse)
def cancel_job(job_id: UUID) -> JobResponse:
    job = jobs.cancel(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="job not found"
        )
    return job_response(job)


@app.get("/api/jobs/{job_id}/events")
def job_events(job_id: UUID) -> StreamingResponse:
    if jobs.get(job_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="job not found"
        )

    def stream():
        job = jobs.get(job_id)
        if job is None:
            yield "event: error\ndata: job not found\n\n"
            return
        version = -1
        while True:
            job, version = jobs.wait_for_update(job_id, version)
            if job is None:
                yield "event: error\ndata: job not found\n\n"
                return
            yield f"id: {version}\nevent: job\ndata: {job_response(job).model_dump_json()}\n\n"
            if job.state in {JobState.COMPLETED, JobState.FAILED, JobState.CANCELLED}:
                return

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
