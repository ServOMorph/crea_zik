from __future__ import annotations

import hashlib
import json
import sys
import wave
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from engine import MANIFEST, render, validate_params  # noqa: E402

REFERENCES_DIR = ROOT / "references"
SAMPLE_RATE = MANIFEST["engine"]["sample_rate"]
VELOCITY = 1.0


def pcm24_bytes(audio: np.ndarray) -> bytes:
    pcm = np.rint(np.clip(audio, -1.0, 1.0) * 8_388_607.0).astype(np.int32).reshape(-1)
    packed = np.empty((len(pcm), 3), dtype=np.uint8)
    packed[:, 0] = pcm & 0xFF
    packed[:, 1] = (pcm >> 8) & 0xFF
    packed[:, 2] = (pcm >> 16) & 0xFF
    return packed.tobytes()


def write_wav(path: Path, audio: np.ndarray, sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(3)
        output.setframerate(sample_rate)
        output.writeframes(pcm24_bytes(audio))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render_all() -> dict[str, Any]:
    presets = json.loads((ROOT / "presets.json").read_text(encoding="utf-8"))
    references: dict[str, Any] = {}
    for name in MANIFEST["presets"]:
        params = presets[name]
        validate_params(params)
        audio = render(params, VELOCITY, SAMPLE_RATE)
        wav_path = REFERENCES_DIR / f"{name}.wav"
        write_wav(wav_path, audio, SAMPLE_RATE)
        references[name] = {
            "sha256": sha256_file(wav_path),
            "sample_rate": SAMPLE_RATE,
            "velocity": VELOCITY,
        }
    (REFERENCES_DIR / "references.json").write_text(
        json.dumps(references, indent=2) + "\n", encoding="utf-8"
    )
    return references


def main() -> None:
    print(json.dumps(render_all(), indent=2))


if __name__ == "__main__":
    main()
