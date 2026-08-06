from __future__ import annotations

import json
import shutil
from collections.abc import Collection
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from threading import Condition, Event, RLock
from uuid import UUID, uuid4

from .compositions import render_composition
from .engine import CsoundEngine, RenderCancelled, RenderEngine
from .errors import error_detail
from .logging import log_event
from .models import Composition, ErrorDetail, JobState, Patch
from .provenance import resolve_project_path, composition_hash
from .qa import evaluate_wav


@dataclass
class RenderJob:
    id: UUID = field(default_factory=uuid4)
    project_id: UUID = field(default_factory=uuid4)
    patch_id: UUID = field(default_factory=uuid4)
    state: JobState = JobState.QUEUED
    progress: int = 0
    error: ErrorDetail | None = None
    wav: str | None = None
    artifacts: dict[str, str] = field(default_factory=dict)
    composition_id: UUID | None = None
    composition_revision: int | None = None
    future: Future[None] | None = None
    cancel_requested: Event = field(default_factory=Event, repr=False)
    version: int = 0


class JobManager:
    def __init__(self, project_root: Path = Path("projects"), engine_factory: type[RenderEngine] = CsoundEngine) -> None:
        # NOTE: max_workers=1 est intentionnel. Les rendus sont toujours traités en file sériée
        # (1 à la fois, les autres en attente). Cela évite les conflits de ressources (DSP, fichiers)
        # et simplifie la gestion des états. Voir EDITEUR/_contexte/signals.md pour la décision utilisateur.
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
        log_event("render_queued", job_id=job.id, project_id=project_id, patch_id=patch.id)
        return job

    def submit_composition(
        self,
        project_id: UUID,
        composition: Composition,
        *,
        track_ids: Collection[UUID] | None = None,
        start_beat: float = 0,
        end_beat: float | None = None,
        loop: bool = False,
        clip_ids: Collection[UUID] | None = None,
    ) -> RenderJob:
        job = RenderJob(
            project_id=project_id,
            patch_id=composition.id,
            composition_id=composition.id,
            composition_revision=composition.revision,
        )
        with self._condition:
            self._jobs[job.id] = job
            job.future = self._executor.submit(
                self._render_composition,
                job,
                composition.model_copy(deep=True),
                set(track_ids) if track_ids is not None else None,
                start_beat,
                end_beat,
                loop,
                set(clip_ids) if clip_ids is not None else None,
            )
            self._changed(job)
        log_event(
            "composition_render_queued",
            job_id=job.id,
            project_id=project_id,
            composition_id=composition.id,
            revision=composition.revision,
        )
        return job

    def _render(self, job: RenderJob, patch: Patch) -> None:
        with self._condition:
            if job.cancel_requested.is_set():
                return
            job.state, job.progress = JobState.RUNNING, 10
            self._changed(job)
        log_event("render_started", job_id=job.id, project_id=job.project_id, patch_id=job.patch_id)
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
                    outcome = "render_cancelled"
                else:
                    job.wav = artifact.wav_path.resolve().relative_to(self._project_root.resolve()).as_posix()
                    job.progress, job.state = 100, JobState.COMPLETED
                    outcome = "render_completed"
                self._changed(job)
            log_event(outcome, job_id=job.id, project_id=job.project_id, patch_id=job.patch_id)
        except RenderCancelled:
            with self._condition:
                job.state = JobState.CANCELLED
                self._changed(job)
            log_event("render_cancelled", job_id=job.id, project_id=job.project_id, patch_id=job.patch_id)
        except Exception as error:  # noqa: BLE001
            with self._condition:
                if job.cancel_requested.is_set():
                    job.state = JobState.CANCELLED
                else:
                    job.error, job.state = error_detail(error), JobState.FAILED
                self._changed(job)
            log_event(
                "render_failed", job_id=job.id, project_id=job.project_id, patch_id=job.patch_id,
                error_code=error_detail(error).code,
            )

    def _render_composition(
        self,
        job: RenderJob,
        composition: Composition,
        track_ids: set[UUID] | None,
        start_beat: float,
        end_beat: float | None,
        loop: bool = False,
        clip_ids: set[UUID] | None = None,
    ) -> None:
        with self._condition:
            if job.cancel_requested.is_set():
                return
            job.state, job.progress = JobState.RUNNING, 10
            self._changed(job)
        render_directory = resolve_project_path(
            self._project_root,
            str(job.project_id),
            "compositions",
            str(composition.id),
            f"revision-{composition.revision}",
        )
        destination = (
            render_directory
            if start_beat == 0 and end_beat is None and clip_ids is None and not loop
            else render_directory / "previews" / str(job.id)
        )

        if clip_ids is not None:
            selected_clips = [c for c in composition.clips if c.id in clip_ids]
            composition.clips = selected_clips
            if selected_clips:
                if start_beat == 0 and end_beat is None:
                    start_beat = min(c.start_beat for c in selected_clips)
                    end_beat = max(c.start_beat + c.length_beats * c.repeat_count for c in selected_clips)
            else:
                start_beat = 0
                end_beat = 0.25

        def report_progress(progress: int) -> None:
            with self._condition:
                if job.state is JobState.RUNNING and progress > job.progress:
                    job.progress = progress
                    self._changed(job)

        try:
            rendered = render_composition(
                composition,
                destination,
                track_ids=track_ids,
                start_beat=start_beat,
                end_beat=end_beat,
                cancelled=job.cancel_requested.is_set,
                progress=report_progress,
                loop=loop,
                clip_ids=clip_ids,
            )
            if job.cancel_requested.is_set():
                raise RenderCancelled("render cancelled")

            # Evaluate QA
            from uuid import uuid5, NAMESPACE_URL
            qa_id = uuid5(NAMESPACE_URL, f"crea-zik:{job.project_id}:{composition.id}:{composition.revision}")
            qa_report = evaluate_wav(
                qa_id,
                rendered.mix_path,
                profile="music",
                loop=loop,
            )
            qa_json_path = destination / "qa.json"
            qa_json_path.write_text(qa_report.model_dump_json(indent=2), encoding="utf-8")

            relative = lambda path: path.resolve().relative_to(self._project_root.resolve()).as_posix()
            artifacts = {
                "mix": relative(rendered.mix_path),
                **{f"stem:{track_id}": relative(path) for track_id, path in rendered.stem_paths.items()},
            }
            manifest_path = destination / "manifest.json"
            manifest_data = {
                "composition_id": str(composition.id),
                "revision": composition.revision,
                "start_beat": start_beat,
                "end_beat": end_beat,
                "track_ids": sorted(str(track_id) for track_id in track_ids) if track_ids else None,
                "artifacts": artifacts,
                "seed": composition.seed,
                "versions": {
                    "engine": "csound7",
                    "schema_version": composition.schema_version,
                },
                "spec_hash": composition_hash(composition),
                "qa": qa_report.model_dump(mode="json"),
            }
            manifest_path.write_text(
                json.dumps(manifest_data, indent=2, sort_keys=True),
                encoding="utf-8",
            )
            if destination != render_directory:
                render_directory.mkdir(parents=True, exist_ok=True)
                shutil.copy2(rendered.mix_path, render_directory / "mix.wav")
                shutil.copy2(manifest_path, render_directory / "manifest.json")
                shutil.copy2(qa_json_path, render_directory / "qa.json")
            artifacts["manifest"] = relative(manifest_path)
            with self._condition:
                job.wav = artifacts["mix"]
                job.artifacts = artifacts
                job.progress, job.state = 100, JobState.COMPLETED
                self._changed(job)
            log_event(
                "composition_render_completed",
                job_id=job.id,
                project_id=job.project_id,
                composition_id=composition.id,
                revision=composition.revision,
            )
        except RenderCancelled:
            with self._condition:
                job.state = JobState.CANCELLED
                self._changed(job)
            log_event("composition_render_cancelled", job_id=job.id, project_id=job.project_id)
        except Exception as error:  # noqa: BLE001
            with self._condition:
                if job.cancel_requested.is_set():
                    job.state = JobState.CANCELLED
                else:
                    job.error, job.state = error_detail(error), JobState.FAILED
                self._changed(job)
            log_event(
                "composition_render_failed",
                job_id=job.id,
                project_id=job.project_id,
                error_code=error_detail(error).code,
            )

    def get(self, job_id: UUID) -> RenderJob | None:
        with self._condition:
            return self._jobs.get(job_id)

    def list_jobs(self) -> list[RenderJob]:
        """Retourne une copie de la liste de tous les jobs (pour l'API)."""
        with self._condition:
            return list(self._jobs.values())

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
            log_event("render_cancel_requested", job_id=job.id, project_id=job.project_id, patch_id=job.patch_id)
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
