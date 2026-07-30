from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .cli import PROJECT_ROOT, load_project, save_project
from .engine import CsoundEngine
from .gallery import examples
from .jobs import JobManager, JobState, RenderJob
from .models import ErrorDetail, Patch, Project
from .provenance import resolve_project_path

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


def job_response(job: RenderJob) -> JobResponse:
    return JobResponse(id=job.id, state=job.state, progress=job.progress, error=job.error, wav=job.wav)


def project_path(project_id: UUID) -> Path:
    return resolve_project_path(PROJECT_ROOT, str(project_id), "project.json")


def get_project(project_id: UUID) -> Project:
    path = project_path(project_id)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return load_project(path)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "csound7"}


@app.get("/api/projects", response_model=list[Project])
def list_projects() -> list[Project]:
    if not PROJECT_ROOT.exists():
        return []
    return [load_project(path) for path in PROJECT_ROOT.glob("*/project.json")]


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
def create_variants(project_id: UUID, patch_id: UUID, count: int = 10) -> Project:
    if not 1 <= count <= 20:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="count must be between 1 and 20")
    project = get_project(project_id)
    source = next((item for item in project.patches if item.id == patch_id), None)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="patch not found")
    existing_seeds = {item.seed for item in project.patches}
    for offset in range(1, count + 1):
        seed = source.seed + offset
        while seed in existing_seeds:
            seed += count
        existing_seeds.add(seed)
        project.patches.append(source.model_copy(update={"id": uuid4(), "name": f"{source.name} · variante {offset}", "seed": seed}))
    save_project(project, project_path(project.id))
    return project


@app.post("/api/projects/{project_id}/patches/{patch_id}/render", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
def render_patch(project_id: UUID, patch_id: UUID) -> JobResponse:
    project = get_project(project_id)
    patch = next((item for item in project.patches if item.id == patch_id), None)
    if patch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="patch not found")
    return job_response(jobs.submit(project.id, patch))


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
