from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .models import Patch, PatchKind
from .provenance import patch_hash


@dataclass(frozen=True)
class Artifact:
    wav_path: Path
    spec_hash: str
    engine: str


class RenderEngine:
    def render(self, patch: Patch, output: Path) -> Artifact:  # pragma: no cover - interface
        raise NotImplementedError


class CsoundEngine(RenderEngine):
    def __init__(self, executable: Path | None = None) -> None:
        local = Path("benchmarks/engine_selection/csound7-runtime/bin/csound.exe")
        self.executable = executable or (local if local.exists() else Path(shutil.which("csound") or ""))
        if not self.executable.exists():
            raise RuntimeError("Csound 7 is unavailable; install the locked local runtime first.")

    def _body(self, patch: Patch) -> str:
        if patch.kind is PatchKind.UI_CLICK:
            return f"aenv expon {patch.gain}, p3, .0001\na oscili aenv, 1700, 1\nout a, a"
        if patch.kind is PatchKind.MODAL_IMPACT:
            return f"aenv expon {patch.gain}, p3, .0001\na1 oscili aenv, 173, 1\na2 oscili aenv*.65, 269, 1\na3 oscili aenv*.35, 421, 1\nout a1+a2+a3, a1+a2+a3"
        return f"alfo oscili 18, .35, 1\na oscili {patch.gain}, 92+alfo, 1\nout a, a"

    def render(self, patch: Patch, output: Path) -> Artifact:
        output.parent.mkdir(parents=True, exist_ok=True)
        csd = output.with_suffix(".csd")
        csd.write_text("\n".join(("<CsoundSynthesizer>", "<CsOptions>", f'-d -W -o "{output}"', "</CsOptions>", "<CsInstruments>", f"sr=48000\nksmps=32\nnchnls=2\n0dbfs=1\ngi1 ftgen 1,0,16384,10,1\ninstr 1\n{self._body(patch)}\nendin", "</CsInstruments>", "<CsScore>", f"i1 0 {patch.duration_seconds}", "</CsScore>", "</CsoundSynthesizer>")), encoding="utf-8")
        subprocess.run([str(self.executable), str(csd)], check=True, capture_output=True, text=True, timeout=30)
        return Artifact(wav_path=output, spec_hash=patch_hash(patch), engine="csound7")
