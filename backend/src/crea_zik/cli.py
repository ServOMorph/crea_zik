from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from .engine import CsoundEngine
from .models import Patch, Project
from .provenance import patch_hash, resolve_project_path

PROJECT_ROOT = Path(os.environ.get("CREA_ZIK_PROJECT_ROOT", "projects"))


def load_project(path: Path) -> Project:
    if PROJECT_ROOT.resolve() not in path.resolve().parents:
        raise ValueError("project path must stay inside projects/")
    return Project.model_validate_json(path.read_text(encoding="utf-8"))


def save_project(project: Project, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(project.model_dump_json(indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(prog="crea-zik")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("new"); create.add_argument("name")
    validate = commands.add_parser("validate"); validate.add_argument("project", type=Path)
    render = commands.add_parser("render"); render.add_argument("project", type=Path); render.add_argument("patch")
    analyze = commands.add_parser("analyze"); analyze.add_argument("project", type=Path); analyze.add_argument("patch")
    export = commands.add_parser("export"); export.add_argument("project", type=Path); export.add_argument("patch")
    args = parser.parse_args()
    if args.command == "new":
        project = Project(name=args.name)
        patch = Patch(name="Clic UI", kind="ui_click", seed=42, duration_seconds=.12)
        project.patches.append(patch)
        path = resolve_project_path(PROJECT_ROOT, str(project.id), "project.json")
        save_project(project, path)
        print(path)
    elif args.command == "validate":
        project = load_project(args.project)
        print(json.dumps({"valid": True, "project": str(project.id), "patches": len(project.patches)}))
    elif args.command == "render":
        project = load_project(args.project)
        patch = next(item for item in project.patches if str(item.id) == args.patch or item.name == args.patch)
        destination = resolve_project_path(PROJECT_ROOT, str(project.id), "artifacts", f"{patch.id}.wav")
        artifact = CsoundEngine().render(patch, destination)
        print(json.dumps({"wav": str(artifact.wav_path), "hash": artifact.spec_hash, "engine": artifact.engine}))
    elif args.command == "analyze":
        project = load_project(args.project)
        patch = next(item for item in project.patches if str(item.id) == args.patch or item.name == args.patch)
        wav = resolve_project_path(PROJECT_ROOT, str(project.id), "artifacts", f"{patch.id}.wav")
        print(json.dumps({"wav": str(wav), "bytes": wav.stat().st_size, "hash": patch_hash(patch)}))
    else:
        project = load_project(args.project)
        patch = next(item for item in project.patches if str(item.id) == args.patch or item.name == args.patch)
        source = resolve_project_path(PROJECT_ROOT, str(project.id), "artifacts", f"{patch.id}.wav")
        destination = resolve_project_path(PROJECT_ROOT, str(project.id), "exports", f"{patch.id}.wav")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        print(destination)
