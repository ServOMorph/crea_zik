from __future__ import annotations

import hashlib
from pathlib import Path

from crea_zik.engine import CsoundEngine
from crea_zik.models import Patch, PatchKind

ROOT = Path(__file__).resolve().parents[1]


def test_csound_renderer_is_byte_deterministic_for_a_seeded_patch(
    tmp_path: Path,
) -> None:
    executable = (
        ROOT
        / "benchmarks"
        / "engine_selection"
        / "csound7-runtime"
        / "bin"
        / "csound.exe"
    )
    engine = CsoundEngine(executable=executable, timeout_seconds=60)
    patch = Patch(
        name="V0 determinism",
        kind=PatchKind.WHOOSH,
        seed=20260730,
        duration_seconds=0.2,
        parameters={"brightness": 0.4, "drive": 0.2, "noise_color": 0.4},
    )
    hashes: list[str] = []
    for index in range(2):
        output = tmp_path / f"determinism-{index}.wav"
        engine.render(patch, output)
        hashes.append(hashlib.sha256(output.read_bytes()).hexdigest())
    assert len(set(hashes)) == 1
