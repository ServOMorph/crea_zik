"""
Tests for Phase V12: Rendering ranges, stems, formats, and loops.
Covers all combinations of render scopes, formats, and outputs.
"""

from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from crea_zik.api import app
from crea_zik.jobs import JobManager


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
    project = client.post("/api/projects", json={"name": "render_test"}).json()
    source = client.get("/api/composition-gallery").json()[0]
    composition = client.post(
        f"/api/projects/{project['id']}/compositions",
        json={"example_id": source["id"]},
    ).json()
    
    yield client, project, composition, manager
    manager.shutdown()


class TestRenderRanges:
    """Test rendering different time ranges (full, partial, loop)."""

    def test_render_full_composition(self, project_and_composition):
        """Render the entire composition."""
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.1
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        queued = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={},
        )
        assert queued.status_code == 202
        job_id = queued.json()["id"]
        
        # Wait for completion
        job = manager.get(UUID(job_id))
        assert job is not None and job.future is not None
        job.future.result(timeout=10)
        
        completed = client.get(f"/api/jobs/{job_id}").json()
        assert completed["state"] == "completed"
        
        # Verify manifest
        manifest = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/manifest"
        ).json()
        assert manifest["composition_id"] == saved["id"]
        assert manifest["revision"] == 1

    def test_render_beat_range(self, project_and_composition):
        """Render a specific beat range (e.g., beats 0-8)."""
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.2
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        queued = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={"start_beat": 0, "end_beat": 8},
        )
        assert queued.status_code == 202
        job_id = queued.json()["id"]
        
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)
        
        completed = client.get(f"/api/jobs/{job_id}").json()
        assert completed["state"] == "completed"

    def test_render_loop(self, project_and_composition):
        """Render a looped section (e.g., beats 0-4 looped)."""
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.1
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        queued = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={"start_beat": 0, "end_beat": 4, "loop": True},
        )
        assert queued.status_code == 202
        job_id = queued.json()["id"]
        
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)
        
        completed = client.get(f"/api/jobs/{job_id}").json()
        assert completed["state"] == "completed"


class TestRenderStems:
    """Test rendering individual stems and master."""

    def test_render_all_stems(self, project_and_composition):
        """Render all 5 stems + master."""
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.1
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        queued = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={"stems": True},
        )
        assert queued.status_code == 202
        job_id = queued.json()["id"]
        
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)
        
        # Verify all stems are present in the manifest
        manifest = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/manifest"
        ).json()
        assert "artifacts" in manifest
        # Check that all track stems are present (stem:<track_id>)
        stem_keys = [key for key in manifest["artifacts"].keys() if key.startswith("stem:")]
        assert len(stem_keys) == len(saved["tracks"])
        assert "mix" in manifest["artifacts"]

    def test_render_single_track_stem(self, project_and_composition):
        """Render a single track stem (e.g., drums only)."""
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.1
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        # Get the first track ID (assume it's drums)
        track_id = saved["tracks"][0]["id"]
        queued = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={"track_ids": [track_id]},
        )
        assert queued.status_code == 202
        job_id = queued.json()["id"]
        
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)
        
        completed = client.get(f"/api/jobs/{job_id}").json()
        assert completed["state"] == "completed"


class TestRenderFormats:
    """Test rendering in different WAV formats (PCM16, PCM24, float32)."""

    @pytest.mark.parametrize("format", ["wav_pcm16", "wav_pcm24", "wav_float32"])
    def test_render_format(self, project_and_composition, format):
        """Render in a specific WAV format."""
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.1
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        queued = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={"format": format},
        )
        assert queued.status_code == 202
        job_id = queued.json()["id"]
        
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)
        
        completed = client.get(f"/api/jobs/{job_id}").json()
        assert completed["state"] == "completed"
        
        # Verify the artifact is present in the manifest
        manifest = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/manifest"
        ).json()
        assert "mix" in manifest["artifacts"]


class TestRenderClipSelection:
    """Test rendering specific clips."""

    def test_render_selected_clips(self, project_and_composition):
        """Render only selected clips."""
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.1
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        # Select the first 2 clips
        clip_ids = [saved["clips"][i]["id"] for i in range(min(2, len(saved["clips"])))]
        queued = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={"clip_ids": clip_ids},
        )
        assert queued.status_code == 202
        job_id = queued.json()["id"]
        
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)
        
        completed = client.get(f"/api/jobs/{job_id}").json()
        assert completed["state"] == "completed"



