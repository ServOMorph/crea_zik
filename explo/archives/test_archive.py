from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from archive_piece import archive_piece, verify_archive


class ArchiveTests(unittest.TestCase):
    def descriptor(self, source: Path) -> Path:
        (source / "render.py").write_text("print('render')\n", encoding="utf-8")
        (source / "master.wav").write_bytes(b"RIFF-test")
        payload = {
            "schema_version": 1,
            "piece_id": "test-piece",
            "title": "Test",
            "version": "v001",
            "created_at": "2026-07-30",
            "parent_version": None,
            "status": "prototype",
            "summary": "Première version.",
            "inspiration": {
                "request": "Test",
                "translation": "Test technique.",
                "constraints": ["Aucun asset externe."]
            },
            "technical": {"sample_rate": 48000},
            "files": [
                {"path": "render.py", "role": "renderer", "description": "Rendu."},
                {"path": "master.wav", "role": "master", "description": "Master."}
            ]
        }
        path = source / "archive.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        return path

    def test_archive_is_immutable_deduplicated_and_verifiable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            archive_root = root / "archive"
            source.mkdir()
            descriptor = self.descriptor(source)
            manifest_path = archive_piece(descriptor, archive_root)
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(len(manifest["files"]), 2)
            self.assertEqual(verify_archive(archive_root), [])

            second = json.loads(descriptor.read_text(encoding="utf-8"))
            second["version"] = "v002"
            second["parent_version"] = "v001"
            descriptor.write_text(json.dumps(second), encoding="utf-8")
            archive_piece(descriptor, archive_root)
            self.assertEqual(len(list((archive_root / "blobs").rglob("*.*"))), 2)
            with self.assertRaises(FileExistsError):
                archive_piece(descriptor, archive_root)

    def test_verification_detects_a_corrupted_blob(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            archive_root = root / "archive"
            source.mkdir()
            manifest_path = archive_piece(self.descriptor(source), archive_root)
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            blob = archive_root / manifest["files"][0]["blob"]
            blob.write_bytes(b"corrupted")
            self.assertTrue(verify_archive(archive_root))


if __name__ == "__main__":
    unittest.main()
