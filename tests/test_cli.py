import json
import sys
from pathlib import Path

import pytest

from crea_zik import cli
from crea_zik.engine import Artifact
from crea_zik.models import Patch


class FakeEngine:
    def render(self, patch: Patch, output: Path) -> Artifact:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"deterministic wav")
        return Artifact(wav_path=output, spec_hash="a" * 64, engine="fake")


def run_cli(monkeypatch: pytest.MonkeyPatch, *arguments: str) -> None:
    monkeypatch.setattr(sys, "argv", ["crea-zik", *arguments])
    cli.main()


def test_cli_new_render_analyze_and_export_write_a_manifest(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    root = tmp_path / "projects"
    monkeypatch.setattr(cli, "PROJECT_ROOT", root)
    monkeypatch.setattr(cli, "CsoundEngine", FakeEngine)

    run_cli(monkeypatch, "new", "CLI demo")
    created = json.loads(capsys.readouterr().out)
    project_path = Path(created["path"])

    run_cli(monkeypatch, "validate", str(project_path))
    assert json.loads(capsys.readouterr().out)["valid"] is True

    run_cli(monkeypatch, "render", str(project_path), "Clic UI")
    rendered = json.loads(capsys.readouterr().out)
    assert Path(rendered["wav"]).is_file()

    run_cli(monkeypatch, "analyze", str(project_path), "Clic UI")
    assert json.loads(capsys.readouterr().out)["bytes"] == len(b"deterministic wav")

    run_cli(monkeypatch, "export", str(project_path), "Clic UI")
    exported = json.loads(capsys.readouterr().out)
    manifest = json.loads(Path(exported["manifest"]).read_text(encoding="utf-8"))
    assert Path(exported["wav"]).is_file()
    assert manifest["artifact"]["sha256"]
    assert manifest["provenance"]["spec_hash"]


def test_cli_returns_a_structured_error_for_an_unknown_patch(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    root = tmp_path / "projects"
    monkeypatch.setattr(cli, "PROJECT_ROOT", root)
    run_cli(monkeypatch, "new", "CLI demo")
    project_path = Path(json.loads(capsys.readouterr().out)["path"])

    with pytest.raises(SystemExit, match="2"):
        run_cli(monkeypatch, "render", str(project_path), "missing")
    error = json.loads(capsys.readouterr().err.splitlines()[-1])
    assert error["code"] == "patch_not_found"
