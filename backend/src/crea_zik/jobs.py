from __future__ import annotations

from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import StrEnum
from threading import Lock
from pathlib import Path
from uuid import UUID, uuid4

from .engine import CsoundEngine
from .models import Patch
from .provenance import resolve_project_path


class JobState(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class RenderJob:
    id: UUID = field(default_factory=uuid4)
    project_id: UUID = field(default_factory=uuid4)
    patch_id: UUID = field(default_factory=uuid4)
    state: JobState = JobState.QUEUED
    progress: int = 0
    error: str | None = None
    wav: str | None = None
    future: Future[None] | None = None


class JobManager:
    def __init__(self) -> None:
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="crea-zik-render")
        self._jobs: dict[UUID, RenderJob] = {}
        self._lock = Lock()

    def submit(self, project_id: UUID, patch: Patch) -> RenderJob:
        job = RenderJob(project_id=project_id, patch_id=patch.id)
        with self._lock:
            self._jobs[job.id] = job
        job.future = self._executor.submit(self._render, job, patch)
        return job

    def _render(self, job: RenderJob, patch: Patch) -> None:
        if job.state is JobState.CANCELLED:
            return
        job.state, job.progress = JobState.RUNNING, 10
        try:
            output = resolve_project_path(Path("projects"), str(job.project_id), "artifacts", f"{patch.id}.wav")
            artifact = CsoundEngine().render(patch, output)
            if job.state is not JobState.CANCELLED:
                job.wav = artifact.wav_path.resolve().relative_to(Path("projects").resolve()).as_posix()
                job.progress, job.state = 100, JobState.COMPLETED
        except Exception as error:  # recorded and returned as an actionable job failure
            job.error, job.state = str(error), JobState.FAILED

    def get(self, job_id: UUID) -> RenderJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def cancel(self, job_id: UUID) -> RenderJob | None:
        job = self.get(job_id)
        if job is None:
            return None
        if job.state is JobState.QUEUED and job.future and job.future.cancel():
            job.state = JobState.CANCELLED
        return job


jobs = JobManager()
