from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
import wave
from pathlib import Path
from types import ModuleType
from typing import Any


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_renderer(path: Path) -> ModuleType:
    specification = importlib.util.spec_from_file_location(
        "lignes_de_nuit_renderer", path
    )
    if specification is None or specification.loader is None:
        raise RuntimeError(f"Renderer unavailable: {path}")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


def inspect_wav(path: Path) -> dict[str, Any]:
    with wave.open(str(path), "rb") as handle:
        frames = handle.getnframes()
        sample_rate = handle.getframerate()
        return {
            "channels": handle.getnchannels(),
            "sample_rate": sample_rate,
            "duration_seconds": frames / sample_rate,
            "sample_width_bytes": handle.getsampwidth(),
        }


def require_equal(
    name: str, actual: object, expected: object, errors: list[str]
) -> None:
    if actual != expected:
        errors.append(f"{name}: expected {expected!r}, got {actual!r}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--golden", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()

    source = arguments.source.resolve()
    golden = json.loads(arguments.golden.read_text(encoding="utf-8"))
    spec_path = source / "spec.json"
    errors: list[str] = []
    require_equal(
        "source_spec_sha256", sha256(spec_path), golden["source_spec_sha256"], errors
    )

    arguments.output.mkdir(parents=True, exist_ok=True)
    renderer = load_renderer(source / "render.py")
    renderer.render(spec_path, arguments.output)

    master = arguments.output / "lignes_de_nuit_30s.wav"
    require_equal("master_sha256", sha256(master), golden["master_sha256"], errors)
    for name, expected_hash in golden["stems_sha256"].items():
        stem = arguments.output / "stems" / f"{name}.wav"
        require_equal(f"stems_sha256.{name}", sha256(stem), expected_hash, errors)

    audio = inspect_wav(master)
    expected_audio = golden["audio"]
    require_equal(
        "audio.channels", audio["channels"], expected_audio["channels"], errors
    )
    require_equal(
        "audio.sample_rate", audio["sample_rate"], expected_audio["sample_rate"], errors
    )
    require_equal(
        "audio.duration_seconds",
        audio["duration_seconds"],
        expected_audio["duration_seconds"],
        errors,
    )
    require_equal("audio.sample_width_bytes", audio["sample_width_bytes"], 3, errors)

    report = {
        "ok": not errors,
        "errors": errors,
        "audio": audio,
        "master_sha256": sha256(master),
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
