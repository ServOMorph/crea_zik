import hashlib
import json
from pathlib import Path

from crea_zik.api import app
from crea_zik.plugins import EXPLO_PLUGINS_ROOT
from fastapi.testclient import TestClient


def test_list_plugins_includes_kick() -> None:
    client = TestClient(app)
    response = client.get("/api/plugins")
    assert response.status_code == 200
    plugins = {item["plugin_id"]: item for item in response.json()}
    assert "kick" in plugins
    assert set(plugins["kick"]["presets"]) == {"techno", "808_sub", "acoustique"}


def test_read_plugin_manifest_matches_generic_schema() -> None:
    client = TestClient(app)
    response = client.get("/api/plugins/kick/manifest")
    assert response.status_code == 200
    manifest = response.json()
    assert manifest["plugin_id"] == "kick"
    assert manifest["schema_version"] == 1


def test_read_plugin_manifest_unknown_plugin_is_404() -> None:
    client = TestClient(app)
    response = client.get("/api/plugins/does-not-exist/manifest")
    assert response.status_code == 404


def test_read_plugin_preset_returns_full_param_set() -> None:
    client = TestClient(app)
    response = client.get("/api/plugins/kick/presets/techno")
    assert response.status_code == 200
    params = response.json()
    assert params["seed"] == 1001
    assert params["click_type"] == "noise"


def test_read_plugin_preset_unknown_is_404() -> None:
    client = TestClient(app)
    response = client.get("/api/plugins/kick/presets/does-not-exist")
    assert response.status_code == 404


def test_render_plugin_matches_phase1_reference(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    response = client.post("/api/plugins/kick/render", json={"preset": "techno"})
    assert response.status_code == 200
    artifact = response.json()

    references = json.loads((EXPLO_PLUGINS_ROOT / "kick" / "references" / "references.json").read_text(encoding="utf-8"))
    wav_path = (tmp_path / "projects" / artifact["wav"]).resolve()
    assert hashlib.sha256(wav_path.read_bytes()).hexdigest() == references["techno"]["sha256"]
    assert artifact["sample_rate"] == references["techno"]["sample_rate"]
    assert artifact["is_clipping"] is False


def test_render_plugin_out_of_bounds_override_is_422(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    response = client.post(
        "/api/plugins/kick/render",
        json={"preset": "techno", "overrides": {"pitch_start": 99999.0}},
    )
    assert response.status_code == 422


def test_render_plugin_unknown_preset_is_404(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    response = client.post("/api/plugins/kick/render", json={"preset": "does-not-exist"})
    assert response.status_code == 404


def test_render_plugin_unknown_plugin_is_404(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    response = client.post("/api/plugins/does-not-exist/render", json={"preset": "techno"})
    assert response.status_code == 404
