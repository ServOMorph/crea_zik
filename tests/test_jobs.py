import logging
from pathlib import Path
from threading import Event
from uuid import uuid4

import pytest
from crea_zik.compositions import render_composition
from crea_zik.engine import Artifact, RenderCancelled
from crea_zik.errors import RenderTimeoutError
from crea_zik.gallery import composition_examples
from crea_zik.jobs import JobManager, JobState
from crea_zik.models import Patch, PatchKind


class BlockingEngine:
    started = Event()

    def render(self, patch, output: Path, cancelled=None, progress=None) -> Artifact:
        if progress:
            progress(20)
        self.started.set()
        while not (cancelled and cancelled()):
            Event().wait(.01)
        raise RenderCancelled("Render cancelled")


class InstantEngine:
    def render(self, patch, output: Path, cancelled=None, progress=None) -> Artifact:
        if progress:
            progress(75)
        if cancelled and cancelled():
            raise RenderCancelled("Render cancelled")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"wav")
        return Artifact(output, "test-hash", "test")


class ProgressEngine:
    started = Event()
    release = Event()

    def render(self, patch, output: Path, cancelled=None, progress=None) -> Artifact:
        if progress:
            progress(20)
        self.started.set()
        assert self.release.wait(timeout=1)
        if progress:
            progress(75)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"wav")
        return Artifact(output, "test-hash", "test")


class TimeoutEngine:
    def render(self, patch, output: Path, cancelled=None, progress=None) -> Artifact:
        raise RenderTimeoutError("Render exceeded its allowed duration.")


def patch() -> Patch:
    return Patch(name="click", kind=PatchKind.UI_CLICK, seed=42, duration_seconds=.12)


def test_cancelled_job_does_not_block_the_next_job(tmp_path: Path) -> None:
    BlockingEngine.started.clear()
    manager = JobManager(tmp_path, BlockingEngine)
    first = manager.submit(uuid4(), patch())
    assert BlockingEngine.started.wait(timeout=1)

    queued = manager.submit(uuid4(), patch())
    assert manager.cancel(queued.id).state is JobState.CANCELLED
    assert manager.cancel(first.id).state is JobState.CANCELLED

    manager._engine_factory = InstantEngine
    successor = manager.submit(uuid4(), patch())
    successor.future.result(timeout=2)
    assert manager.get(successor.id).state is JobState.COMPLETED
    assert manager.get(queued.id).state is JobState.CANCELLED
    manager.shutdown()


def test_composition_job_cancels_and_can_be_resubmitted(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    started = Event()

    def blocking_render(*args: object, **kwargs: object) -> object:
        progress = kwargs.get("progress")
        if callable(progress):
            progress(20)
        started.set()
        cancelled = kwargs.get("cancelled")
        while not (callable(cancelled) and cancelled()):
            Event().wait(0.01)
        raise RenderCancelled("cancelled")

    monkeypatch.setattr("crea_zik.jobs.render_composition", blocking_render)
    manager = JobManager(tmp_path)
    composition = composition_examples()[0]
    composition = composition.model_copy(
        update={
            "render_settings": composition.render_settings.model_copy(
                update={"duration_seconds": 0.01}
            )
        }
    )

    cancelled = manager.submit_composition(uuid4(), composition)
    assert started.wait(timeout=1)
    assert manager.cancel(cancelled.id)
    assert cancelled.future is not None
    cancelled.future.result(timeout=1)
    assert manager.get(cancelled.id).state is JobState.CANCELLED

    monkeypatch.setattr("crea_zik.jobs.render_composition", render_composition)
    resumed = manager.submit_composition(uuid4(), composition)
    assert resumed.future is not None
    resumed.future.result(timeout=5)
    assert manager.get(resumed.id).state is JobState.COMPLETED
    assert manager.get(resumed.id).artifacts["mix"].endswith("mix.wav")
    manager.shutdown()


def test_job_updates_are_versioned_and_include_progress(tmp_path: Path) -> None:
    ProgressEngine.started.clear()
    ProgressEngine.release.clear()
    manager = JobManager(tmp_path, ProgressEngine)
    job = manager.submit(uuid4(), patch())
    assert ProgressEngine.started.wait(timeout=1)
    updated, version = manager.wait_for_update(job.id, -1, timeout=1)
    assert updated is not None
    assert updated.progress == 20
    assert version >= 1
    ProgressEngine.release.set()
    job.future.result(timeout=1)
    final, final_version = manager.wait_for_update(job.id, version, timeout=1)
    assert final is not None
    assert final.state is JobState.COMPLETED
    assert final.progress == 100
    assert final_version > version
    manager.shutdown()


def test_timed_out_job_exposes_a_typed_error_and_structured_log(tmp_path: Path, caplog) -> None:
    caplog.set_level(logging.INFO, logger="crea_zik")
    manager = JobManager(tmp_path, TimeoutEngine)
    job = manager.submit(uuid4(), patch())
    job.future.result(timeout=1)
    completed = manager.get(job.id)
    assert completed is not None
    assert completed.state is JobState.FAILED
    assert completed.error is not None
    assert completed.error.code == "render_timeout"
    assert any('"event": "render_failed"' in record.message for record in caplog.records)
    manager.shutdown()
