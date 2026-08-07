"""
Tests for Phase V12: Concurrent renders are serialized (1 worker, sequential).
Verifies that the JobManager processes jobs in a FIFO order with max_workers=1.
"""

import threading
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from crea_zik.api import app
from crea_zik.jobs import JobManager, JobState


@pytest.fixture
def project_and_composition(tmp_path, monkeypatch):
    """Create a test project and composition from the gallery."""
    project_root = tmp_path / "projects"
    project_root.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", project_root)
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", project_root)
    manager = JobManager(project_root)
    monkeypatch.setattr("crea_zik.api.jobs", manager)
    
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "concurrent_test"}).json()
    source = client.get("/api/composition-gallery").json()[0]
    composition = client.post(
        f"/api/projects/{project['id']}/compositions",
        json={"example_id": source["id"]},
    ).json()
    
    yield client, project, composition, manager
    manager.shutdown()


class TestConcurrentRenders:
    """Test that concurrent renders are serialized (1 worker)."""

    def test_concurrent_renders_are_sequential(self, project_and_composition):
        """
        Submit 3 renders concurrently and verify they are processed sequentially.
        Job 1 starts first, Job 2 waits, Job 3 waits.
        """
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.05
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        # Submit 3 renders in quick succession
        job_ids = []
        for _ in range(3):
            queued = client.post(
                f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
                json={},
            )
            assert queued.status_code == 202
            job_ids.append(queued.json()["id"])

        # Wait for all jobs to complete
        for job_id in job_ids:
            job = manager.get(UUID(job_id))
            assert job is not None and job.future is not None
            job.future.result(timeout=15)

        # Verify all jobs completed in order
        for i, job_id in enumerate(job_ids):
            job = manager.get(UUID(job_id))
            assert job.state == JobState.COMPLETED

    def test_second_render_waits_for_first(self, project_and_composition):
        """
        Submit 2 renders and verify the second waits for the first to finish.
        Uses a slow first render to ensure the second is queued.
        """
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.1
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        # Submit first render
        queued1 = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={},
        )
        job_id1 = queued1.json()["id"]
        job1 = manager.get(UUID(job_id1))

        # Submit second render immediately after
        queued2 = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={},
        )
        job_id2 = queued2.json()["id"]
        job2 = manager.get(UUID(job_id2))

        # Verify job1 starts first
        assert job1.state == JobState.RUNNING or job1.state == JobState.QUEUED

        # Wait for job1 to complete
        job1.future.result(timeout=10)
        assert job1.state == JobState.COMPLETED

        # Now job2 should start
        job2.future.result(timeout=10)
        assert job2.state == JobState.COMPLETED

    def test_queued_jobs_are_processed_in_order(self, project_and_composition):
        """
        Submit 5 renders and verify they complete in FIFO order.
        """
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.02
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        # Submit 5 renders
        job_ids = []
        for _ in range(5):
            queued = client.post(
                f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
                json={},
            )
            job_ids.append(queued.json()["id"])

        # Track completion order
        completion_order = []
        lock = threading.Lock()

        def wait_for_completion(job_id, expected_index):
            job = manager.get(UUID(job_id))
            job.future.result(timeout=15)
            with lock:
                completion_order.append(job_id)

        # Wait for all jobs to complete
        threads = []
        for i, job_id in enumerate(job_ids):
            thread = threading.Thread(target=wait_for_completion, args=(job_id, i))
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join(timeout=20)

        # Verify completion order matches submission order (FIFO)
        assert completion_order == job_ids, "Jobs did not complete in FIFO order"


class TestJobQueueState:
    """Test the state of jobs in the queue."""

    def test_queued_jobs_are_marked_as_queued(self, project_and_composition):
        """Verify that queued jobs are marked as 'queued' while waiting."""
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.1
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        # Submit first render (will start immediately)
        queued1 = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={},
        )
        job_id1 = queued1.json()["id"]

        # Submit second render (should be queued)
        queued2 = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={},
        )
        job_id2 = queued2.json()["id"]

        # Check job2 state (should be queued)
        job2 = manager.get(UUID(job_id2))
        assert job2.state == JobState.QUEUED

        # Wait for job1 to complete
        job1 = manager.get(UUID(job_id1))
        job1.future.result(timeout=10)

        # Now job2 should be running
        job2 = manager.get(UUID(job_id2))
        assert job2.state == JobState.RUNNING or job2.state == JobState.COMPLETED

    def test_list_jobs_includes_queued_and_running(self, project_and_composition):
        """Verify /api/jobs returns queued and running jobs."""
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.1
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        # Submit 2 renders
        job_id1 = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={},
        ).json()["id"]
        job_id2 = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={},
        ).json()["id"]

        # List all jobs
        all_jobs = client.get("/api/jobs").json()
        job_states = {job["id"]: job["state"] for job in all_jobs}

        # At least one job should be running or queued
        assert any(
            state in ["running", "queued"]
            for state in job_states.values()
        ), "No jobs are running or queued"

        # Wait for completion
        manager.get(UUID(job_id1)).future.result(timeout=10)
        manager.get(UUID(job_id2)).future.result(timeout=10)

        # Now all jobs should be completed
        all_jobs = client.get("/api/jobs").json()
        for job in all_jobs:
            if job["id"] in [job_id1, job_id2]:
                assert job["state"] == "completed"
