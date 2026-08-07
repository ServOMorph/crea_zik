"""
Tests for Phase V12: Validation of manifest and QA report structures.
Ensures all required fields are present and correctly formatted.
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
    project = client.post("/api/projects", json={"name": "manifest_test"}).json()
    source = client.get("/api/composition-gallery").json()[0]
    composition = client.post(
        f"/api/projects/{project['id']}/compositions",
        json={"example_id": source["id"]},
    ).json()
    
    yield client, project, composition, manager
    manager.shutdown()


class TestManifestStructure:
    """Test the structure and content of the manifest."""

    def test_manifest_has_required_fields(self, project_and_composition):
        """Verify all required fields are present in the manifest."""
        client, project, composition, manager = project_and_composition
        composition["render_settings"]["duration_seconds"] = 0.1
        saved = client.put(
            f"/api/projects/{project['id']}/compositions/{composition['id']}",
            json={"expected_revision": 0, "composition": composition},
        ).json()

        # Trigger a render
        queued = client.post(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
            json={"stems": True},
        )
        job_id = queued.json()["id"]
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)

        # Get the manifest
        manifest = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/manifest"
        ).json()

        # Required fields (based on jobs.py:224-238)
        required_fields = [
            "composition_id",
            "revision",
            "seed",
            "artifacts",
            "versions",
            "spec_hash",
            "qa",
        ]
        for field in required_fields:
            assert field in manifest, f"Missing required field: {field}"

    def test_manifest_versions_include_engine(self, project_and_composition):
        """Verify the versions object includes engine versions."""
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
        job_id = queued.json()["id"]
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)

        manifest = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/manifest"
        ).json()

        assert "versions" in manifest
        assert "engine" in manifest["versions"]
        assert manifest["versions"]["engine"] == "csound7"

    def test_manifest_stems_include_all_tracks(self, project_and_composition):
        """Verify all track stems are included in the manifest."""
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
        job_id = queued.json()["id"]
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)

        manifest = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/manifest"
        ).json()

        assert "artifacts" in manifest
        # Check that all track stems are present (stem:<track_id>)
        stem_keys = [key for key in manifest["artifacts"].keys() if key.startswith("stem:")]
        assert len(stem_keys) == len(saved["tracks"])
        for stem_key in stem_keys:
            assert stem_key in manifest["artifacts"]

    def test_manifest_master_includes_artifact(self, project_and_composition):
        """Verify the master artifact is included in the manifest."""
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
        job_id = queued.json()["id"]
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)

        manifest = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/manifest"
        ).json()

        assert "artifacts" in manifest
        assert "mix" in manifest["artifacts"]


class TestQAReportStructure:
    """Test the structure and content of the QA report."""

    def test_qa_report_has_required_fields(self, project_and_composition):
        """Verify all required fields are present in the QA report."""
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
        job_id = queued.json()["id"]
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)

        # Get the QA report directly
        qa_report = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/qa"
        ).json()

        # Required fields
        required_fields = [
            "passed",
            "profile",
            "issues",
            "metrics",
            "artifact_id",
        ]
        for field in required_fields:
            assert field in qa_report, f"Missing required field in QA report: {field}"

    def test_qa_metrics_include_all_required(self, project_and_composition):
        """Verify all required metrics are present in the QA report."""
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
        job_id = queued.json()["id"]
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)

        qa_report = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/qa"
        ).json()

        required_metrics = ["sample_peak", "true_peak", "lufs", "rms", "dc_offset"]
        for metric in required_metrics:
            assert metric in qa_report["metrics"], f"Missing required metric: {metric}"

    def test_qa_issues_are_actionable(self, project_and_composition):
        """Verify QA issues include actionable information."""
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
        job_id = queued.json()["id"]
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)

        qa_report = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/qa"
        ).json()

        # If there are issues, they should be actionable
        for issue in qa_report.get("issues", []):
            assert isinstance(issue, str) or "type" in issue, f"Issue is not actionable: {issue}"


class TestManifestQALinks:
    """Test the links between manifest, QA report, and artifacts."""

    def test_manifest_qa_points_to_valid_report(self, project_and_composition):
        """Verify the QA in the manifest points to a valid report."""
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
        job_id = queued.json()["id"]
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)

        manifest = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/manifest"
        ).json()

        assert "qa" in manifest
        
        # Verify the QA report exists
        qa_report = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/qa"
        ).json()
        assert "passed" in qa_report

    def test_manifest_qa_has_artifact_id(self, project_and_composition):
        """Verify QA report has an artifact_id."""
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
        job_id = queued.json()["id"]
        job = manager.get(UUID(job_id))
        job.future.result(timeout=10)

        qa_report = client.get(
            f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/qa"
        ).json()

        # The QA report should have an artifact_id
        assert "artifact_id" in qa_report
        assert qa_report["artifact_id"] is not None
