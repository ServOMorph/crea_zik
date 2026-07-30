from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .engine import CsoundEngine
from .errors import ArtifactMissingError, CreaZikError, PatchNotFoundError, ProjectPathError, error_detail
from .exports import export_patch
from .logging import configure_logging, log_event
from .models import Patch, Project
from .provenance import patch_hash, resolve_project_path

PROJECT_ROOT = Path(os.environ.get("CREA_ZIK_PROJECT_ROOT", "projects"))


def load_project(path: Path) -> Project:
    if PROJECT_ROOT.resolve() not in path.resolve().parents:
        raise ProjectPathError("Project path must stay inside projects/.")
    return Project.model_validate_json(path.read_text(encoding="utf-8"))


def save_project(project: Project, path: Path) -> None:
    if PROJECT_ROOT.resolve() not in path.resolve().parents:
        raise ProjectPathError("Project path must stay inside projects/.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(project.model_dump_json(indent=2), encoding="utf-8")


def _patch(project: Project, identifier: str) -> Patch:
    patch = next((item for item in project.patches if str(item.id) == identifier or item.name == identifier), None)
    if patch is None:
        raise PatchNotFoundError("Patch was not found in this project.", {"patch": identifier})
    return patch


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(prog="crea-zik")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("new"); create.add_argument("name")
    validate = commands.add_parser("validate"); validate.add_argument("project", type=Path)
    render = commands.add_parser("render"); render.add_argument("project", type=Path); render.add_argument("patch")
    analyze = commands.add_parser("analyze"); analyze.add_argument("project", type=Path); analyze.add_argument("patch")
    export = commands.add_parser("export"); export.add_argument("project", type=Path); export.add_argument("patch")
    args = parser.parse_args()
    try:
        if args.command == "new":
            project = Project(name=args.name)
            patch = Patch(name="Clic UI", kind="ui_click", seed=42, duration_seconds=.12)
            project.patches.append(patch)
            path = resolve_project_path(PROJECT_ROOT, str(project.id), "project.json")
            save_project(project, path)
            result = {"project": str(project.id), "path": str(path)}
        elif args.command == "validate":
            project = load_project(args.project)
            result = {"valid": True, "project": str(project.id), "patches": len(project.patches)}
        elif args.command == "render":
            project = load_project(args.project)
            patch = _patch(project, args.patch)
            destination = resolve_project_path(PROJECT_ROOT, str(project.id), "artifacts", f"{patch.id}.wav")
            artifact = CsoundEngine().render(patch, destination)
            result = {"wav": str(artifact.wav_path), "hash": artifact.spec_hash, "engine": artifact.engine}
        elif args.command == "analyze":
            project = load_project(args.project)
            patch = _patch(project, args.patch)
            wav = resolve_project_path(PROJECT_ROOT, str(project.id), "artifacts", f"{patch.id}.wav")
            if not wav.is_file():
                raise ArtifactMissingError("Render the patch before analyzing it.", {"patch": args.patch})
            result = {"wav": str(wav), "bytes": wav.stat().st_size, "hash": patch_hash(patch)}
        else:
            project = load_project(args.project)
            patch = _patch(project, args.patch)
            destination, manifest = export_patch(PROJECT_ROOT, project, patch)
            result = {"wav": str(destination), "manifest": str(manifest)}
        log_event("cli_command_completed", command=args.command)
        print(json.dumps(result, ensure_ascii=False))
    except (CreaZikError, OSError, ValueError) as error:
        detail = error_detail(error if isinstance(error, Exception) else Exception())
        log_event("cli_command_failed", command=args.command, error_code=detail.code)
        print(detail.model_dump_json(), file=sys.stderr)
        raise SystemExit(2) from error
