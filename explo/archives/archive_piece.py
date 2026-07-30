from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any


ARCHIVE_ROOT = Path(__file__).resolve().parent
PIECE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
VERSION_PATTERN = re.compile(r"^v[0-9]{3}$")
REQUIRED_FIELDS = {
    "schema_version",
    "piece_id",
    "title",
    "version",
    "created_at",
    "parent_version",
    "status",
    "summary",
    "inspiration",
    "technical",
    "files",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while block := source.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def safe_source(root: Path, relative_path: str) -> Path:
    candidate = (root / relative_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"Chemin hors du dossier source: {relative_path}")
    if not candidate.is_file():
        raise FileNotFoundError(candidate)
    return candidate


def validate_descriptor(descriptor: dict[str, Any]) -> None:
    missing = REQUIRED_FIELDS.difference(descriptor)
    if missing:
        raise ValueError(f"Champs manquants: {', '.join(sorted(missing))}")
    if descriptor["schema_version"] != 1:
        raise ValueError("Version de schéma non prise en charge")
    if not PIECE_ID_PATTERN.fullmatch(descriptor["piece_id"]):
        raise ValueError("piece_id invalide")
    if not VERSION_PATTERN.fullmatch(descriptor["version"]):
        raise ValueError("version invalide; format attendu: v001")
    parent = descriptor["parent_version"]
    if parent is not None and not VERSION_PATTERN.fullmatch(parent):
        raise ValueError("parent_version invalide")
    if descriptor["status"] not in {"prototype", "candidate", "validated", "rejected"}:
        raise ValueError("statut invalide")
    if not isinstance(descriptor["files"], list) or not descriptor["files"]:
        raise ValueError("files doit contenir au moins un fichier")
    paths = [entry["path"] for entry in descriptor["files"]]
    if len(paths) != len(set(paths)):
        raise ValueError("Un fichier ne peut être déclaré qu'une fois")


def blob_destination(archive_root: Path, digest: str, source: Path) -> Path:
    suffix = "".join(source.suffixes).lower()
    return archive_root / "blobs" / "sha256" / digest[:2] / f"{digest}{suffix}"


def store_blob(source: Path, archive_root: Path, digest: str) -> Path:
    destination = blob_destination(archive_root, digest, source)
    if destination.exists():
        if sha256(destination) != digest:
            raise RuntimeError(f"Blob corrompu: {destination}")
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        shutil.copyfile(source, temporary_path)
        if sha256(temporary_path) != digest:
            raise RuntimeError(f"Copie non conforme: {source}")
        os.replace(temporary_path, destination)
    finally:
        temporary_path.unlink(missing_ok=True)
    return destination


def relative_link(from_directory: Path, target: Path) -> str:
    return Path(os.path.relpath(target, from_directory)).as_posix()


def version_document(descriptor: dict[str, Any], files: list[dict[str, Any]], version_dir: Path) -> str:
    inspiration = descriptor["inspiration"]
    lines = [
        f"# {descriptor['title']} — {descriptor['version']}",
        "",
        f"Statut : `{descriptor['status']}`  ",
        f"Date : {descriptor['created_at']}  ",
        f"Version parente : `{descriptor['parent_version'] or 'aucune'}`",
        "",
        "## Résumé",
        "",
        descriptor["summary"],
        "",
        "## Inspiration et traduction",
        "",
        f"Demande initiale : {inspiration['request']}",
        "",
        inspiration["translation"],
        "",
        "Contraintes :",
        "",
    ]
    lines.extend(f"- {constraint}" for constraint in inspiration["constraints"])
    lines.extend(["", "## Fichiers archivés", ""])
    for entry in files:
        blob = (version_dir.parents[3] / entry["blob"]).resolve()
        lines.append(
            f"- [{entry['source_path']}]({relative_link(version_dir, blob)}) — "
            f"`{entry['role']}` — {entry['description']}"
        )
    lines.extend(
        [
            "",
            "## Intégrité",
            "",
            "Les tailles et empreintes SHA-256 de tous les fichiers sont enregistrées dans "
            "[manifest.json](manifest.json).",
            "",
        ]
    )
    return "\n".join(lines)


def rebuild_piece_index(piece_dir: Path, archive_root: Path) -> None:
    manifests = []
    for path in sorted((piece_dir / "versions").glob("v*/manifest.json")):
        manifests.append(json.loads(path.read_text(encoding="utf-8")))
    latest = manifests[-1]
    lines = [
        f"# {latest['title']}",
        "",
        f"Identifiant : `{latest['piece_id']}`  ",
        f"Version courante : `{latest['version']}`",
        "",
        "## Versions",
        "",
        "| Version | Date | Statut | Résumé |",
        "|---|---|---|---|",
    ]
    for manifest in manifests:
        version = manifest["version"]
        lines.append(
            f"| [{version}](versions/{version}/README.md) | {manifest['created_at']} | "
            f"{manifest['status']} | {manifest['summary']} |"
        )
    lines.extend(["", "## Lecture rapide", ""])
    master = next((entry for entry in latest["files"] if entry["role"] == "master"), None)
    if master:
        target = archive_root / master["blob"]
        lines.append(f"- [Master de la version courante]({relative_link(piece_dir, target)})")
    creation = next((entry for entry in latest["files"] if entry["role"] == "creation_document"), None)
    if creation:
        target = archive_root / creation["blob"]
        lines.append(f"- [Documentation de création]({relative_link(piece_dir, target)})")
    lines.append("")
    (piece_dir / "README.md").write_text("\n".join(lines), encoding="utf-8")


def rebuild_catalog(archive_root: Path) -> None:
    rows = []
    for piece_readme in sorted((archive_root / "morceaux").glob("*/README.md")):
        piece_dir = piece_readme.parent
        manifests = sorted((piece_dir / "versions").glob("v*/manifest.json"))
        if not manifests:
            continue
        latest = json.loads(manifests[-1].read_text(encoding="utf-8"))
        rows.append(
            f"| [{latest['title']}](morceaux/{piece_dir.name}/README.md) | "
            f"`{latest['piece_id']}` | {latest['version']} | {latest['status']} | {latest['created_at']} |"
        )
    content = [
        "# Catalogue des morceaux",
        "",
        "| Morceau | Identifiant | Version | Statut | Date |",
        "|---|---|---|---|---|",
        *rows,
        "",
    ]
    (archive_root / "CATALOGUE.md").write_text("\n".join(content), encoding="utf-8")


def archive_piece(descriptor_path: Path, archive_root: Path = ARCHIVE_ROOT) -> Path:
    descriptor_path = descriptor_path.resolve()
    descriptor = json.loads(descriptor_path.read_text(encoding="utf-8"))
    validate_descriptor(descriptor)
    source_root = descriptor_path.parent
    piece_dir = archive_root / "morceaux" / descriptor["piece_id"]
    version_dir = piece_dir / "versions" / descriptor["version"]
    if version_dir.exists():
        raise FileExistsError(f"Version déjà archivée: {descriptor['piece_id']} {descriptor['version']}")
    if descriptor["parent_version"]:
        parent = piece_dir / "versions" / descriptor["parent_version"] / "manifest.json"
        if not parent.is_file():
            raise ValueError(f"Version parente absente: {descriptor['parent_version']}")

    archived_files = []
    for entry in descriptor["files"]:
        source = safe_source(source_root, entry["path"])
        digest = sha256(source)
        blob = store_blob(source, archive_root, digest)
        archived_files.append(
            {
                "source_path": entry["path"],
                "role": entry["role"],
                "description": entry["description"],
                "sha256": digest,
                "bytes": source.stat().st_size,
                "blob": blob.relative_to(archive_root).as_posix(),
            }
        )

    manifest = {
        "manifest_schema_version": 1,
        "piece_id": descriptor["piece_id"],
        "title": descriptor["title"],
        "version": descriptor["version"],
        "created_at": descriptor["created_at"],
        "parent_version": descriptor["parent_version"],
        "status": descriptor["status"],
        "summary": descriptor["summary"],
        "inspiration": descriptor["inspiration"],
        "technical": descriptor["technical"],
        "files": archived_files,
    }
    version_dir.mkdir(parents=True)
    write_json(version_dir / "manifest.json", manifest)
    (version_dir / "README.md").write_text(
        version_document(descriptor, archived_files, version_dir),
        encoding="utf-8",
    )
    rebuild_piece_index(piece_dir, archive_root)
    rebuild_catalog(archive_root)
    return version_dir / "manifest.json"


def verify_archive(archive_root: Path = ARCHIVE_ROOT) -> list[str]:
    issues = []
    manifests = sorted((archive_root / "morceaux").glob("*/versions/v*/manifest.json"))
    for manifest_path in manifests:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for entry in manifest["files"]:
            blob = archive_root / entry["blob"]
            if not blob.is_file():
                issues.append(f"Blob absent: {entry['blob']}")
                continue
            if blob.stat().st_size != entry["bytes"]:
                issues.append(f"Taille différente: {entry['blob']}")
            if sha256(blob) != entry["sha256"]:
                issues.append(f"SHA-256 différent: {entry['blob']}")
    return issues


def main() -> None:
    parser = argparse.ArgumentParser(description="Archive et contrôle les morceaux de crea_zik.")
    commands = parser.add_subparsers(dest="command", required=True)
    archive = commands.add_parser("archive")
    archive.add_argument("descriptor", type=Path)
    commands.add_parser("verify")
    args = parser.parse_args()
    if args.command == "archive":
        print(archive_piece(args.descriptor))
        return
    issues = verify_archive()
    if issues:
        print("\n".join(issues))
        raise SystemExit(1)
    print("Archive intègre.")


if __name__ == "__main__":
    main()
