import json
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from crea_zik import plugins as plugins_module
from crea_zik.api import app
from crea_zik.compositions import render_composition
from crea_zik.engine import RenderCancelled
from crea_zik.jobs import JobManager
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

MISSING_PROJECT = "00000000-0000-4000-8000-000000000098"
_manifest_schema_path = plugins_module.PLUGIN_SCHEMA_PATH


def _seed(client: TestClient) -> tuple[dict[str, Any], dict[str, Any]]:
    project = client.post("/api/projects", json={"name": "robustness"}).json()
    source = client.get("/api/composition-gallery").json()[0]
    composition = client.post(
        f"/api/projects/{project['id']}/compositions",
        json={"example_id": source["id"]},
    ).json()
    return project, composition


def _project_root(tmp_path: Path, monkeypatch) -> Path:
    project_root = tmp_path / "projects"
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", project_root)
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", project_root)
    return project_root


@settings(max_examples=20, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(
    invalid=st.text(
        alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.",
        min_size=1,
        max_size=40,
    ).filter(lambda value: not _is_uuid(value) and value not in (".", ".."))
)
def test_composition_paths_reject_malformed_uuids(tmp_path, monkeypatch, invalid) -> None:
    _project_root(tmp_path, monkeypatch)
    client = TestClient(app)
    response = client.get(f"/api/projects/{MISSING_PROJECT}/compositions/{invalid}")
    assert response.status_code == 422


@settings(max_examples=20, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(revision=st.integers(max_value=-1))
def test_composition_render_paths_reject_negative_revision(tmp_path, monkeypatch, revision) -> None:
    _project_root(tmp_path, monkeypatch)
    client = TestClient(app)
    project, composition = _seed(client)
    for resource in ("artifact", "manifest", "qa"):
        response = client.get(
            f"/api/projects/{project['id']}/compositions/{composition['id']}/renders/{revision}/{resource}"
        )
        assert response.status_code == 422


@settings(max_examples=20, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(start_beat=st.floats(min_value=-1000, max_value=-0.1))
def test_composition_render_rejects_negative_start_beat(tmp_path, monkeypatch, start_beat) -> None:
    _project_root(tmp_path, monkeypatch)
    client = TestClient(app)
    project, composition = _seed(client)
    response = client.post(
        f"/api/projects/{project['id']}/compositions/{composition['id']}/render",
        json={"start_beat": start_beat},
    )
    assert response.status_code == 422


@settings(max_examples=20, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(revision=st.integers(max_value=-1))
def test_composition_save_rejects_invalid_expected_revision(tmp_path, monkeypatch, revision) -> None:
    _project_root(tmp_path, monkeypatch)
    client = TestClient(app)
    project, composition = _seed(client)
    response = client.put(
        f"/api/projects/{project['id']}/compositions/{composition['id']}",
        json={"expected_revision": revision, "composition": composition},
    )
    assert response.status_code == 422


def test_composition_save_rejects_id_mismatch(tmp_path, monkeypatch) -> None:
    _project_root(tmp_path, monkeypatch)
    client = TestClient(app)
    project, composition = _seed(client)
    mismatched = {**composition, "id": str(uuid4())}
    response = client.put(
        f"/api/projects/{project['id']}/compositions/{composition['id']}",
        json={"expected_revision": 0, "composition": mismatched},
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "composition_id_mismatch"


def test_composition_save_rejects_dangling_references(tmp_path, monkeypatch) -> None:
    _project_root(tmp_path, monkeypatch)
    client = TestClient(app)
    project, composition = _seed(client)
    dangling = {**composition, "clips": [{**composition["clips"][0], "pattern_id": str(uuid4())}]}
    response = client.put(
        f"/api/projects/{project['id']}/compositions/{composition['id']}",
        json={"expected_revision": 0, "composition": dangling},
    )
    assert response.status_code == 422


def test_composition_create_rejects_unknown_example(tmp_path, monkeypatch) -> None:
    _project_root(tmp_path, monkeypatch)
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "unknown example"}).json()
    response = client.post(
        f"/api/projects/{project['id']}/compositions",
        json={"example_id": str(uuid4())},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "composition gallery example not found"


def test_concurrent_composition_saves_do_not_overwrite(tmp_path, monkeypatch) -> None:
    _project_root(tmp_path, monkeypatch)
    client = TestClient(app)
    project, composition = _seed(client)
    payload = {
        "expected_revision": 0,
        "composition": {**composition, "title": "edite en parallele"},
    }
    url = f"/api/projects/{project['id']}/compositions/{composition['id']}"
    barrier = threading.Barrier(2)

    def save() -> tuple[int, str | None]:
        barrier.wait()
        response = client.put(url, json=payload)
        return response.status_code, response.json().get("detail", {}).get("code")

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = sorted(executor.map(lambda _: save(), range(2)))

    assert {code for code, _ in results} == {200, 409}
    assert [code for _, code in results if code is not None] == ["composition_revision_conflict"]
    reloaded = client.get(url).json()
    assert reloaded["revision"] == 1
    assert reloaded["title"] == "edite en parallele"


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
    except ValueError:
        return False
    return True


def test_api_interrupted_save_preserves_previous_state_and_resumes(
    tmp_path, monkeypatch
) -> None:
    project_root = _project_root(tmp_path, monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    project, composition = _seed(client)
    project_path = project_root / project["id"] / "project.json"
    previous = project_path.read_bytes()

    fail_replace = True
    original_replace = os.replace

    def flaky_replace(source: Path, destination: Path) -> None:
        if fail_replace:
            raise OSError("simulated interruption")
        return original_replace(source, destination)

    monkeypatch.setattr("crea_zik.cli.os.replace", flaky_replace)
    edited = {**composition, "title": "edition a rejouer"}
    response = client.put(
        f"/api/projects/{project['id']}/compositions/{composition['id']}",
        json={"expected_revision": 0, "composition": edited},
    )
    assert response.status_code == 500
    assert project_path.read_bytes() == previous
    assert not list(project_path.parent.glob(".project.json.*.tmp"))

    fail_replace = False
    resumed = client.put(
        f"/api/projects/{project['id']}/compositions/{composition['id']}",
        json={"expected_revision": 0, "composition": edited},
    )
    assert resumed.status_code == 200
    assert resumed.json()["revision"] == 1
    reloaded = client.get(
        f"/api/projects/{project['id']}/compositions/{composition['id']}"
    )
    assert reloaded.json()["title"] == "edition a rejouer"


def test_api_stale_temporary_files_are_cleaned_on_project_read(tmp_path, monkeypatch) -> None:
    project_root = _project_root(tmp_path, monkeypatch)
    client = TestClient(app)
    project, _composition = _seed(client)
    project_path = project_root / project["id"] / "project.json"
    stale = project_path.parent / ".project.json.crashed.tmp"
    stale.write_text("incomplete garbage", encoding="utf-8")

    response = client.get(f"/api/projects/{project['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == project["id"]
    assert not list(project_path.parent.glob(".project.json.*.tmp"))


def test_api_render_cancel_and_resume(tmp_path, monkeypatch) -> None:
    project_root = _project_root(tmp_path, monkeypatch)
    manager = JobManager(project_root)
    monkeypatch.setattr("crea_zik.api.jobs", manager)
    client = TestClient(app)
    project, composition = _seed(client)
    composition["render_settings"]["duration_seconds"] = 0.01
    saved = client.put(
        f"/api/projects/{project['id']}/compositions/{composition['id']}",
        json={"expected_revision": 0, "composition": composition},
    ).json()
    started = threading.Event()

    def blocking_render(*args: object, **kwargs: object) -> object:
        cancelled = kwargs.get("cancelled")
        started.set()
        while not (callable(cancelled) and cancelled()):
            threading.Event().wait(0.01)
        raise RenderCancelled("cancelled")

    monkeypatch.setattr("crea_zik.jobs.render_composition", blocking_render)
    queued = client.post(
        f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
        json={"start_beat": 0, "end_beat": 0.01},
    )
    assert queued.status_code == 202
    job = manager.get(UUID(queued.json()["id"]))
    assert job is not None and started.wait(timeout=2)
    cancelled = client.post(f"/api/jobs/{job.id}/cancel")
    assert cancelled.json()["state"] == "cancelled"
    assert job.future is not None
    job.future.result(timeout=2)
    assert client.get(f"/api/jobs/{job.id}").json()["state"] == "cancelled"

    monkeypatch.setattr("crea_zik.jobs.render_composition", render_composition)
    resumed = client.post(
        f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
        json={"start_beat": 0, "end_beat": 0.01},
    )
    resumed_job = manager.get(UUID(resumed.json()["id"]))
    assert resumed_job is not None and resumed_job.future is not None
    resumed_job.future.result(timeout=10)
    completed = client.get(f"/api/jobs/{resumed_job.id}").json()
    assert completed["state"] == "completed"
    assert completed["composition_revision"] == 1
    artifact = client.get(
        f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/artifact"
    )
    assert artifact.status_code == 200
    with client.stream("GET", f"/api/jobs/{resumed_job.id}/events") as stream:
        body = "".join(stream.iter_text())
    assert "event: job" in body
    assert '"state":"completed"' in body
    assert '"composition_revision":1' in body
    manager.shutdown()


def test_api_projects_are_isolated_from_each_other(tmp_path, monkeypatch) -> None:
    project_root = _project_root(tmp_path, monkeypatch)
    client = TestClient(app)
    project_a, composition = _seed(client)
    project_b = client.post("/api/projects", json={"name": "isole"}).json()
    assert project_b["id"] != project_a["id"]

    cross = client.get(f"/api/projects/{project_b['id']}/compositions/{composition['id']}")
    assert cross.status_code == 422
    assert cross.json()["detail"]["code"] == "composition_not_found"

    edited = {**composition, "title": "A uniquement"}
    updated = client.put(
        f"/api/projects/{project_a['id']}/compositions/{composition['id']}",
        json={"expected_revision": 0, "composition": edited},
    )
    assert updated.status_code == 200
    reloaded_b = client.get(f"/api/projects/{project_b['id']}").json()
    assert reloaded_b["compositions"] == []
    assert {path.name for path in project_root.iterdir()} == {
        project_a["id"],
        project_b["id"],
    }


def test_api_hostile_plugin_ids_never_escape_the_project_root(tmp_path, monkeypatch) -> None:
    project_root = _project_root(tmp_path, monkeypatch)
    plugins_root = tmp_path / "plugins"
    plugin_dir = plugins_root / "ok"
    plugin_dir.mkdir(parents=True)
    manifest = {
        "schema_version": 1,
        "plugin_id": "ok",
        "name": "ok",
        "version": "v1.0.0",
        "kind": "one_shot",
        "engine": {"module": "engine", "function": "render", "sample_rate": 48000},
        "parameter_groups": [
            {
                "id": "general",
                "label": "General",
                "parameters": [
                    {"id": "seed", "type": "float", "min": 0.0, "max": 100.0, "default": 1.0, "unit": "", "curve": "linear"}
                ],
            }
        ],
        "presets": ["p"],
    }
    plugin_dir.joinpath("manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    plugin_dir.joinpath("presets.json").write_text('{"p": {"seed": 1}}', encoding="utf-8")
    plugin_dir.joinpath("engine.py").write_text(
        "def render(params, velocity, sample_rate):\n"
        "    import numpy as np\n"
        "    return np.zeros(int(sample_rate * 0.05))\n",
        encoding="utf-8",
    )
    schema_dir = plugins_root / "schema"
    schema_dir.mkdir()
    schema_dir.joinpath("plugin_manifest.schema.json").write_text(
        _manifest_schema_path.read_text(encoding="utf-8"), encoding="utf-8"
    )
    monkeypatch.setattr("crea_zik.plugins.EXPLO_PLUGINS_ROOT", plugins_root)
    monkeypatch.setattr(
        "crea_zik.plugins.PLUGIN_SCHEMA_PATH",
        plugins_root / "schema" / "plugin_manifest.schema.json",
    )
    client = TestClient(app, raise_server_exceptions=False)
    baseline = {path for path in tmp_path.rglob("*")}

    for plugin_id in ("..%2fescape", "%2e%2e%2fescape", "..%2f..%2f..%2fwindows", "..", "%2e%2e"):
        response = client.post(f"/api/plugins/{plugin_id}/render", json={"preset": "p"})
        assert response.status_code == 404

    assert {path for path in tmp_path.rglob("*")} == baseline
    legitimate = client.post("/api/plugins/ok/render", json={"preset": "p"})
    assert legitimate.status_code == 200
    assert (project_root / legitimate.json()["wav"]).is_file()
