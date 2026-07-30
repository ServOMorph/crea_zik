from __future__ import annotations

import os
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .audio_info import wav_info
from .cli import PROJECT_ROOT, load_project, save_project
from .adaptive import GameplayEvent, simulate_adaptive_graph
from .composer import render_score
from .engine import CsoundEngine
from .errors import CreaZikError, ExportArtifactMissingError, PatchNotFoundError, error_detail
from .exports import export_patch
from .gallery import examples
from .jobs import JobManager, JobState, RenderJob
from .intent import IntentProposal, preview_proposal
from .models import (
    AdaptiveGraph,
    Artifact,
    ErrorDetail,
    Instrument,
    IntentDecision,
    IntentRecord,
    Patch,
    Project,
    QaReport,
    Score,
)
from .ollama import OllamaProposalError, generate_proposal
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


@app.exception_handler(CreaZikError)
async def crea_zik_error_handler(_: Request, error: CreaZikError):
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": error_detail(error).model_dump()})


def job_response(job: RenderJob) -> JobResponse:
    return JobResponse(id=job.id, state=job.state, progress=job.progress, error=job.error, wav=job.wav)


def project_path(project_id: UUID) -> Path:
    return resolve_project_path(PROJECT_ROOT, str(project_id), "project.json")


def get_project(project_id: UUID) -> Project:
    path = project_path(project_id)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return load_project(path)


def get_patch(project: Project, patch_id: UUID) -> Patch:
    patch = next((item for item in project.patches if item.id == patch_id), None)
    if patch is None:
        raise PatchNotFoundError("patch not found")
    return patch


def record_proposal_decision(project: Project, proposal: IntentProposal, decision: IntentDecision) -> None:
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


@app.post("/api/projects", response_model=Project, status_code=status.HTTP_201_CREATED)
def create_project(payload: CreateProject) -> Project:
    project = Project(name=payload.name)
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/patches", response_model=Project)
def add_patch(project_id: UUID, patch: Patch) -> Project:
    project = get_project(project_id)
    project.patches.append(patch)
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/proposals/preview", response_model=Project)
def preview_intent_proposal(project_id: UUID, proposal: IntentProposal) -> Project:
    return preview_proposal(get_project(project_id), proposal)


@app.post("/api/projects/{project_id}/proposals/generate", response_model=IntentProposal)
def generate_intent_proposal(project_id: UUID, request: IntentRequest) -> IntentProposal:
    try:
        return generate_proposal(get_project(project_id), request.intent)
    except OllamaProposalError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@app.post("/api/projects/{project_id}/proposals/apply", response_model=Project)
def apply_intent_proposal(project_id: UUID, request: AcceptedProposal) -> Project:
    if not request.accepted:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="proposal must be explicitly accepted")
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


@app.get("/api/projects/{project_id}/proposals/history", response_model=list[IntentRecord])
def list_intent_history(project_id: UUID) -> list[IntentRecord]:
    return get_project(project_id).intent_history


@app.patch("/api/projects/{project_id}/patches/{patch_id}", response_model=Project)
def update_patch(project_id: UUID, patch_id: UUID, update: PatchUpdate) -> Project:
    project = get_project(project_id)
    index = next((index for index, item in enumerate(project.patches) if item.id == patch_id), None)
    if index is None:
        raise PatchNotFoundError("patch not found")
    project.patches[index] = Patch.model_validate(project.patches[index].model_dump() | update.model_dump(exclude_none=True))
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/instruments", response_model=Project)
def add_instrument(project_id: UUID, instrument: Instrument) -> Project:
    project = get_project(project_id)
    if instrument.patch_id not in {patch.id for patch in project.patches}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="instrument patch not found")
    project.instruments.append(instrument)
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/scores", response_model=Project)
def add_score(project_id: UUID, score: Score) -> Project:
    project = get_project(project_id)
    project.scores.append(score)
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/scores/{score_id}/render", response_model=ScoreRenderResponse)
def render_project_score(project_id: UUID, score_id: UUID) -> ScoreRenderResponse:
    project = get_project(project_id)
    score = next((item for item in project.scores if item.id == score_id), None)
    if score is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="score not found")
    destination = resolve_project_path(PROJECT_ROOT, str(project.id), "scores", str(score.id))
    rendered = render_score(score, project.instruments, destination, project.sample_rate)
    relative = lambda path: path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
    return ScoreRenderResponse(
        mix=relative(rendered.mix_path),
        stems={instrument_id: relative(path) for instrument_id, path in rendered.stem_paths.items()},
        frame_count=rendered.frame_count,
    )


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
    graph = next((item for item in project.adaptive_graphs if item.id == graph_id), None)
    if graph is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="adaptive graph not found")
    decisions = simulate_adaptive_graph(
        graph,
        [GameplayEvent(at_beats=event.at_beats, values=event.values) for event in request.events],
        request.beats_per_bar,
    )
    return [TransitionDecisionResponse.model_validate(decision, from_attributes=True) for decision in decisions]


@app.post("/api/projects/{project_id}/gallery/{example_id}", response_model=Project)
def copy_gallery_example(project_id: UUID, example_id: UUID) -> Project:
    project = get_project(project_id)
    source = next((item for item in examples() if item.id == example_id), None)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="gallery example not found")
    copy = source.model_copy(update={"id": uuid4()})
    project.patches.append(copy)
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/patches/{patch_id}/variants", response_model=Project)
def create_variants(project_id: UUID, patch_id: UUID, request: VariantRequest | None = None) -> Project:
    request = request or VariantRequest()
    project = get_project(project_id)
    source = next((item for item in project.patches if item.id == patch_id), None)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="patch not found")
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
        project.patches.append(source.model_copy(update={"id": uuid4(), "name": f"{source.name} · variante {offset}", "seed": seed}))
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/patches/{patch_id}/render", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
def render_patch(project_id: UUID, patch_id: UUID) -> JobResponse:
    project = get_project(project_id)
    patch = get_patch(project, patch_id)
    return job_response(jobs.submit(project.id, patch))


@app.get("/api/projects/{project_id}/patches/{patch_id}/artifact", response_model=ArtifactResponse)
def read_artifact(project_id: UUID, patch_id: UUID) -> ArtifactResponse:
    project = get_project(project_id)
    patch = get_patch(project, patch_id)
    path = resolve_project_path(PROJECT_ROOT, str(project.id), "artifacts", f"{patch.id}.wav")
    if not path.is_file():
        raise ExportArtifactMissingError("Render the patch before reading its artifact.", {"patch_id": str(patch.id)})
    payload = wav_info(path)
    payload["wav"] = path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
    return ArtifactResponse.model_validate(payload)


@app.post("/api/projects/{project_id}/patches/{patch_id}/analyze", response_model=QaReport)
def analyze_patch(project_id: UUID, patch_id: UUID, request: QaRequest = QaRequest()) -> QaReport:
    project = get_project(project_id)
    patch = get_patch(project, patch_id)
    path = resolve_project_path(PROJECT_ROOT, str(project.id), "artifacts", f"{patch.id}.wav")
    if not path.is_file():
        raise ExportArtifactMissingError("Render the patch before analyzing it.", {"patch_id": str(patch.id)})
    artifact = next((item for item in project.artifacts if item.patch_id == patch.id), None)
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
    project.qa_reports = [item for item in project.qa_reports if item.artifact_id != artifact.id] + [report]
    save_project(project, project_path(project.id))
    return report


@app.post("/api/projects/{project_id}/patches/{patch_id}/export", response_model=ExportResponse)
def export_project_patch(project_id: UUID, patch_id: UUID) -> ExportResponse:
    project = get_project(project_id)
    patch = get_patch(project, patch_id)
    destination, manifest = export_patch(PROJECT_ROOT, project, patch)
    return ExportResponse(
        wav=destination.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix(),
        manifest=manifest.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix(),
    )


@app.get("/api/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID) -> JobResponse:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    return job_response(job)


@app.post("/api/jobs/{job_id}/cancel", response_model=JobResponse)
def cancel_job(job_id: UUID) -> JobResponse:
    job = jobs.cancel(job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    return job_response(job)


@app.get("/api/jobs/{job_id}/events")
def job_events(job_id: UUID) -> StreamingResponse:
    if jobs.get(job_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")

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
        stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
