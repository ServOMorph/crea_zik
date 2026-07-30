import wave
from pathlib import Path
from uuid import UUID

from crea_zik.api import app
from crea_zik.jobs import JobManager
from fastapi.testclient import TestClient


def test_health() -> None:
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["engine"] == "csound7"


def test_create_project_and_patch(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    created = client.post("/api/projects", json={"name": "API demo"})
    assert created.status_code == 201
    project = created.json()
    added = client.post(f"/api/projects/{project['id']}/patches", json={"name": "click", "kind": "ui_click", "seed": 7, "duration_seconds": .12})
    assert added.status_code == 200
    assert len(added.json()["patches"]) == 1


def test_gallery_is_stable_and_copyable(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    examples = client.get("/api/gallery").json()
    assert len(examples) == 7
    project = client.post("/api/projects", json={"name": "gallery demo"}).json()
    copied = client.post(f"/api/projects/{project['id']}/gallery/{examples[0]['id']}")
    assert copied.status_code == 200
    assert copied.json()["patches"][0]["id"] != examples[0]["id"]


def test_composition_gallery_is_immutable_and_copyable(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    source = client.get("/api/composition-gallery")
    project = client.post("/api/projects", json={"name": "composition gallery"}).json()
    copied = client.post(f"/api/projects/{project['id']}/composition-gallery/{source.json()[0]['id']}")

    assert source.status_code == 200
    assert len(source.json()[0]["tracks"]) == 5
    assert copied.status_code == 200
    assert copied.json()["compositions"][0]["id"] != source.json()[0]["id"]
    assert copied.json()["compositions"][0]["tracks"][0]["id"] != source.json()[0]["tracks"][0]["id"]


def test_composition_resources_save_reload_and_conflict(tmp_path: Path, monkeypatch) -> None:
    project_root = tmp_path / "projects"
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", project_root)
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", project_root)
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "composition API"}).json()
    source = client.get("/api/composition-gallery").json()[0]
    created = client.post(
        f"/api/projects/{project['id']}/compositions",
        json={"example_id": source["id"]},
    )
    assert created.status_code == 201
    composition = created.json()

    for resource in ("tracks", "patterns", "clips", "automation", "mixer"):
        response = client.get(
            f"/api/projects/{project['id']}/compositions/{composition['id']}/{resource}"
        )
        assert response.status_code == 200
    composition["title"] = "Lignes de nuit modifiee"
    saved = client.put(
        f"/api/projects/{project['id']}/compositions/{composition['id']}",
        json={"expected_revision": 0, "composition": composition},
    )
    assert saved.status_code == 200
    assert saved.json()["revision"] == 1
    assert client.get(
        f"/api/projects/{project['id']}/compositions/{composition['id']}"
    ).json()["title"] == "Lignes de nuit modifiee"

    conflict = client.put(
        f"/api/projects/{project['id']}/compositions/{composition['id']}",
        json={"expected_revision": 0, "composition": composition},
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "composition_revision_conflict"


def test_composition_render_is_a_revisioned_job(tmp_path: Path, monkeypatch) -> None:
    project_root = tmp_path / "projects"
    manager = JobManager(project_root)
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", project_root)
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", project_root)
    monkeypatch.setattr("crea_zik.api.jobs", manager)
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "composition render"}).json()
    source = client.get("/api/composition-gallery").json()[0]
    composition = client.post(
        f"/api/projects/{project['id']}/compositions",
        json={"example_id": source["id"]},
    ).json()
    composition["render_settings"]["duration_seconds"] = .01
    saved = client.put(
        f"/api/projects/{project['id']}/compositions/{composition['id']}",
        json={"expected_revision": 0, "composition": composition},
    ).json()

    queued = client.post(
        f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
        json={"track_ids": [saved["tracks"][0]["id"]], "start_beat": 0, "end_beat": .01},
    )
    assert queued.status_code == 202
    job = manager.get(UUID(queued.json()["id"]))
    assert job is not None and job.future is not None
    job.future.result(timeout=2)
    completed = client.get(f"/api/jobs/{job.id}")
    assert completed.json()["state"] == "completed"
    assert completed.json()["composition_revision"] == 1
    assert (project_root / completed.json()["artifacts"]["mix"]).is_file()
    assert (project_root / completed.json()["artifacts"]["manifest"]).is_file()
    second = client.post(
        f"/api/projects/{project['id']}/compositions/{saved['id']}/render",
        json={"track_ids": [saved["tracks"][0]["id"]], "start_beat": .005, "end_beat": .01},
    )
    second_job = manager.get(UUID(second.json()["id"]))
    assert second_job is not None and second_job.future is not None
    second_job.future.result(timeout=2)
    second_completed = client.get(f"/api/jobs/{second_job.id}").json()
    assert second_completed["artifacts"]["mix"] != completed.json()["artifacts"]["mix"]
    assert (project_root / second_completed["artifacts"]["mix"]).is_file()
    artifact = client.get(
        f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/artifact"
    )
    manifest = client.get(
        f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/manifest"
    )
    analyzed = client.post(
        f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/analyze"
    )
    report = client.get(
        f"/api/projects/{project['id']}/compositions/{saved['id']}/renders/1/qa"
    )
    assert artifact.status_code == 200
    assert manifest.json()["revision"] == 1
    assert analyzed.status_code == 200
    assert report.json()["artifact_id"] == analyzed.json()["artifact_id"]
    manager.shutdown()


def test_variants_have_unique_seeds(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "variants"}).json()
    patched = client.post(
        f"/api/projects/{project['id']}/patches",
        json={
            "name": "click",
            "kind": "ui_click",
            "seed": 4,
            "duration_seconds": .12,
            "parameters": {"pitch_hz": 800, "brightness": .5},
        },
    ).json()
    variants = client.post(
        f"/api/projects/{project['id']}/patches/{patched['patches'][0]['id']}/variants",
        json={"count": 10, "locked_parameters": ["pitch_hz"]},
    ).json()
    assert len(variants["patches"]) == 11
    assert len({patch["seed"] for patch in variants["patches"]}) == 11
    assert {patch["parameters"]["pitch_hz"] for patch in variants["patches"]} == {800}


def test_patch_metadata_can_be_saved(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "metadata"}).json()
    patched = client.post(
        f"/api/projects/{project['id']}/patches",
        json={"name": "click", "kind": "ui_click", "seed": 4, "duration_seconds": .12},
    ).json()
    patch = patched["patches"][0]
    updated = client.patch(
        f"/api/projects/{project['id']}/patches/{patch['id']}",
        json={"favorite": True, "tags": ["ui"], "notes": "keep"},
    )
    assert updated.status_code == 200
    assert updated.json()["patches"][0]["favorite"] is True
    assert updated.json()["patches"][0]["tags"] == ["ui"]


def test_api_requires_acceptance_before_applying_a_proposal(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "proposal"}).json()
    patch = client.post(
        f"/api/projects/{project['id']}/patches",
        json={"name": "click", "kind": "ui_click", "seed": 1, "duration_seconds": .1},
    ).json()["patches"][0]
    proposal = {"intent": "brighter", "operations": [{"op": "replace", "patch_id": patch["id"], "path": "parameters.brightness", "value": .8}]}

    preview = client.post(f"/api/projects/{project['id']}/proposals/preview", json=proposal)
    rejected = client.post(f"/api/projects/{project['id']}/proposals/apply", json={"accepted": False, "proposal": proposal})
    accepted = client.post(f"/api/projects/{project['id']}/proposals/apply", json={"accepted": True, "proposal": proposal})
    history = client.get(f"/api/projects/{project['id']}/proposals/history")

    assert preview.json()["patches"][0]["parameters"]["brightness"] == .8
    assert rejected.status_code == 422
    assert accepted.json()["patches"][0]["parameters"]["brightness"] == .8
    assert history.json()[0]["decision"] == "accepted"


def test_api_records_a_rejected_proposal_without_modifying_the_project(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "rejection"}).json()
    patch = client.post(
        f"/api/projects/{project['id']}/patches",
        json={"name": "click", "kind": "ui_click", "seed": 1, "duration_seconds": .1},
    ).json()["patches"][0]
    proposal = {"intent": "brighter", "operations": [{"op": "replace", "patch_id": patch["id"], "path": "parameters.brightness", "value": .8}]}

    rejected = client.post(f"/api/projects/{project['id']}/proposals/reject", json=proposal)
    reread = client.get(f"/api/projects/{project['id']}")

    assert rejected.status_code == 200
    assert reread.json()["patches"][0]["parameters"] == {}
    assert reread.json()["intent_history"][0]["decision"] == "rejected"


def test_api_generates_a_proposal_through_the_local_provider(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "proposal generation"}).json()
    patch = client.post(
        f"/api/projects/{project['id']}/patches",
        json={"name": "click", "kind": "ui_click", "seed": 1, "duration_seconds": .1},
    ).json()["patches"][0]

    def local_provider(_project, intent):
        return {
            "intent": intent,
            "rationale": "La brillance est une macro disponible.",
            "expected_impacts": ["Le clic sera plus lumineux."],
            "operations": [
                {"op": "replace", "patch_id": patch["id"], "path": "parameters.brightness", "value": .8}
            ],
        }

    monkeypatch.setattr("crea_zik.api.generate_proposal", local_provider)
    generated = client.post(f"/api/projects/{project['id']}/proposals/generate", json={"intent": "plus lumineux"})

    assert generated.status_code == 200
    assert generated.json()["rationale"] == "La brillance est une macro disponible."
    assert generated.json()["operations"][0]["path"] == "parameters.brightness"


def test_api_renders_a_score_with_synchronized_stems(tmp_path: Path, monkeypatch) -> None:
    project_root = tmp_path / "projects"
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", project_root)
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", project_root)
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "composer"}).json()
    patch = client.post(
        f"/api/projects/{project['id']}/patches",
        json={"name": "tone", "kind": "ui_click", "seed": 1, "duration_seconds": .1},
    ).json()["patches"][0]
    instrument = client.post(
        f"/api/projects/{project['id']}/instruments",
        json={"name": "lead", "patch_id": patch["id"], "seed": 2, "polyphony": 2},
    ).json()["instruments"][0]
    score = client.post(
        f"/api/projects/{project['id']}/scores",
        json={
            "name": "phrase",
            "seed": 3,
            "tempo_bpm": 120,
            "events": [{"instrument_id": instrument["id"], "start_beats": 0, "duration_beats": 1, "midi_note": 60, "velocity": .8}],
        },
    ).json()["scores"][0]

    rendered = client.post(f"/api/projects/{project['id']}/scores/{score['id']}/render")

    assert rendered.status_code == 200
    assert rendered.json()["frame_count"] == 24_000
    assert (project_root / rendered.json()["mix"]).is_file()
    assert len(rendered.json()["stems"]) == 1


def test_api_simulates_an_adaptive_graph(tmp_path: Path, monkeypatch) -> None:
    project_root = tmp_path / "projects"
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", project_root)
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", project_root)
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "adaptive"}).json()
    exploration = "00000000-0000-4000-8000-000000000001"
    tension = "00000000-0000-4000-8000-000000000002"
    graph = client.post(
        f"/api/projects/{project['id']}/adaptive-graphs",
        json={
            "name": "gameplay",
            "seed": 1,
            "initial_state_id": exploration,
            "states": [{"id": exploration, "name": "exploration"}, {"id": tension, "name": "tension"}],
            "transitions": [{"source_state_id": exploration, "target_state_id": tension, "condition": "intensity >= 0.5", "quantization": "bar"}],
        },
    ).json()["adaptive_graphs"][0]

    simulated = client.post(
        f"/api/projects/{project['id']}/adaptive-graphs/{graph['id']}/simulate",
        json={"events": [{"at_beats": 1.1, "values": {"intensity": .8}}]},
    )

    assert simulated.status_code == 200
    assert simulated.json()[0]["scheduled_beats"] == 4


def test_artifact_metadata_and_export_are_available_from_the_api(tmp_path: Path, monkeypatch) -> None:
    project_root = tmp_path / "projects"
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", project_root)
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", project_root)
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "export demo"}).json()
    updated = client.post(
        f"/api/projects/{project['id']}/patches",
        json={"name": "click", "kind": "ui_click", "seed": 7, "duration_seconds": 0.12},
    ).json()
    patch = updated["patches"][0]
    artifact = project_root / project["id"] / "artifacts" / f"{patch['id']}.wav"
    artifact.parent.mkdir(parents=True)
    with wave.open(str(artifact), "wb") as source:
        source.setnchannels(1)
        source.setsampwidth(2)
        source.setframerate(48_000)
        source.writeframes(b"\x00\x00\xff\x7f" * 48)

    metadata = client.get(f"/api/projects/{project['id']}/patches/{patch['id']}/artifact")
    assert metadata.status_code == 200
    assert metadata.json()["sample_rate"] == 48_000
    assert metadata.json()["peak"] == 1
    assert metadata.json()["is_clipping"] is True

    report = client.post(f"/api/projects/{project['id']}/patches/{patch['id']}/analyze", json={"loop": True})
    assert report.status_code == 200
    assert report.json()["passed"] is False
    assert "clipping" in report.json()["issues"]

    exported = client.post(f"/api/projects/{project['id']}/patches/{patch['id']}/export")
    assert exported.status_code == 200
    assert (project_root / exported.json()["wav"]).is_file()
    assert (project_root / exported.json()["manifest"]).is_file()
