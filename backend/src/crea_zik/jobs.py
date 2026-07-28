from __future__ import annotations

from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import StrEnum
from threading import Condition, Event, RLock
from pathlib import Path
from uuid import UUID, uuid4

from .engine import CsoundEngine, RenderCancelled, RenderEngine
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
    cancel_requested: Event = field(default_factory=Event, repr=False)
    version: int = 0


class JobManager:
    def __init__(self, project_root: Path = Path("projects"), engine_factory: type[RenderEngine] = CsoundEngine) -> None:
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="crea-zik-render")
        self._jobs: dict[UUID, RenderJob] = {}
        self._project_root = project_root
        self._engine_factory = engine_factory
        self._condition = Condition(RLock())

    def _changed(self, job: RenderJob) -> None:
        job.version += 1
        self._condition.notify_all()

    def submit(self, project_id: UUID, patch: Patch) -> RenderJob:
        job = RenderJob(project_id=project_id, patch_id=patch.id)
        with self._condition:
            self._jobs[job.id] = job
            job.future = self._executor.submit(self._render, job, patch)
            self._changed(job)
        return job

    def _render(self, job: RenderJob, patch: Patch) -> None:
        with self._condition:
            if job.cancel_requested.is_set():
                return
            job.state, job.progress = JobState.RUNNING, 10
            self._changed(job)
        try:
            output = resolve_project_path(self._project_root, str(job.project_id), "artifacts", f"{patch.id}.wav")
            def report_progress(progress: int) -> None:
                with self._condition:
                    if job.state is JobState.RUNNING and progress > job.progress:
                        job.progress = progress
                        self._changed(job)

            artifact = self._engine_factory().render(
                patch, output, cancelled=job.cancel_requested.is_set, progress=report_progress
            )
            with self._condition:
                if job.cancel_requested.is_set():
                    artifact.wav_path.unlink(missing_ok=True)
                else:
                    job.wav = artifact.wav_path.resolve().relative_to(self._project_root.resolve()).as_posix()
                    job.progress, job.state = 100, JobState.COMPLETED
                self._changed(job)
        except RenderCancelled:
            with self._condition:
                job.state = JobState.CANCELLED
                self._changed(job)
        except Exception as error:  # recorded and returned as an actionable job failure
            with self._condition:
                if job.cancel_requested.is_set():
                    job.state = JobState.CANCELLED
                else:
                    job.error, job.state = str(error), JobState.FAILED
                self._changed(job)

    def get(self, job_id: UUID) -> RenderJob | None:
        with self._condition:
            return self._jobs.get(job_id)

    def cancel(self, job_id: UUID) -> RenderJob | None:
        with self._condition:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            if job.state in {JobState.COMPLETED, JobState.FAILED, JobState.CANCELLED}:
                return job
            job.cancel_requested.set()
            if job.future:
                job.future.cancel()
            job.state = JobState.CANCELLED
            self._changed(job)
            return job

    def wait_for_update(self, job_id: UUID, version: int, timeout: float = 15) -> tuple[RenderJob | None, int]:
        with self._condition:
            self._condition.wait_for(
                lambda: job_id not in self._jobs or self._jobs[job_id].version != version,
                timeout=timeout,
            )
            job = self._jobs.get(job_id)
            return job, job.version if job else version

    def shutdown(self) -> None:
        self._executor.shutdown(wait=True, cancel_futures=True)


jobs = JobManager()
