from pathlib import Path
from threading import Event
from uuid import uuid4

from crea_zik.engine import Artifact, RenderCancelled
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
