from fastapi.testclient import TestClient

from crea_zik.api import PROJECT_ROOT, app


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
    assert len(examples) == 3
    project = client.post("/api/projects", json={"name": "gallery demo"}).json()
    copied = client.post(f"/api/projects/{project['id']}/gallery/{examples[0]['id']}")
    assert copied.status_code == 200
    assert copied.json()["patches"][0]["id"] != examples[0]["id"]


def test_variants_have_unique_seeds(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "variants"}).json()
    patched = client.post(f"/api/projects/{project['id']}/patches", json={"name": "click", "kind": "ui_click", "seed": 4, "duration_seconds": .12}).json()
    variants = client.post(f"/api/projects/{project['id']}/patches/{patched['patches'][0]['id']}/variants?count=10").json()
    assert len(variants["patches"]) == 11
    assert len({patch["seed"] for patch in variants["patches"]}) == 11
