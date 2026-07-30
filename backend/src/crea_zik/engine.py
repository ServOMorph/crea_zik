from __future__ import annotations

import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .models import Patch, PatchKind
from .errors import RenderEngineUnavailableError, RenderFailedError, RenderTimeoutError
from .provenance import patch_hash


@dataclass(frozen=True)
class Artifact:
    wav_path: Path
    spec_hash: str
    engine: str


class RenderCancelled(Exception):
    """Raised when an offline render is stopped by its owning job."""


class RenderEngine:
    def render(
        self,
        patch: Patch,
        output: Path,
        cancelled: Callable[[], bool] | None = None,
        progress: Callable[[int], None] | None = None,
    ) -> Artifact:  # pragma: no cover - interface
        raise NotImplementedError


class CsoundEngine(RenderEngine):
    def __init__(self, executable: Path | None = None, timeout_seconds: float = 180) -> None:
        local = Path("benchmarks/engine_selection/csound7-runtime/bin/csound.exe")
        system = shutil.which("csound")
        self.executable = executable or (local if local.is_file() else Path(system) if system else None)
        if self.executable is None or not self.executable.is_file():
            raise RenderEngineUnavailableError("Csound 7 is unavailable; install the locked local runtime first.")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        self.timeout_seconds = timeout_seconds

    def _body(self, patch: Patch) -> str:
        if patch.kind is PatchKind.UI_CLICK:
            return f"aenv expon {patch.gain}, p3, .0001\na oscili aenv, 1700, 1\nout a, a"
        if patch.kind is PatchKind.MODAL_IMPACT:
            return f"aenv expon {patch.gain}, p3, .0001\na1 oscili aenv, 173, 1\na2 oscili aenv*.65, 269, 1\na3 oscili aenv*.35, 421, 1\nout a1+a2+a3, a1+a2+a3"
        return f"alfo oscili 18, .35, 1\na oscili {patch.gain}, 92+alfo, 1\nout a, a"

    def render(
        self,
        patch: Patch,
        output: Path,
        cancelled: Callable[[], bool] | None = None,
        progress: Callable[[int], None] | None = None,
    ) -> Artifact:
        output.parent.mkdir(parents=True, exist_ok=True)
        csd = output.with_suffix(".csd")
        csd.write_text("\n".join(("<CsoundSynthesizer>", "<CsOptions>", f'-d -W -o "{output}"', "</CsOptions>", "<CsInstruments>", f"sr=48000\nksmps=32\nnchnls=2\n0dbfs=1\ngi1 ftgen 1,0,16384,10,1\ninstr 1\n{self._body(patch)}\nendin", "</CsInstruments>", "<CsScore>", f"i1 0 {patch.duration_seconds}", "</CsScore>", "</CsoundSynthesizer>")), encoding="utf-8")
        process = subprocess.Popen(
            [str(self.executable), str(csd)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        if progress:
            progress(20)
        polls = 0
        started_at = time.monotonic()
        try:
            while process.poll() is None:
                if cancelled and cancelled():
                    process.terminate()
                    try:
                        process.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
                    output.unlink(missing_ok=True)
                    raise RenderCancelled("Render cancelled")
                if time.monotonic() - started_at > self.timeout_seconds:
                    process.terminate()
                    try:
                        process.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
                    output.unlink(missing_ok=True)
                    raise RenderTimeoutError("Render exceeded its allowed duration.")
                try:
                    stdout, stderr = process.communicate(timeout=.1)
                except subprocess.TimeoutExpired:
                    polls += 1
                    if progress:
                        progress(min(90, 50 + polls))
                    continue
            stdout, stderr = process.communicate()
        except BaseException:
            if process.poll() is None:
                process.kill()
                process.wait()
            raise
        if process.returncode:
            raise RenderFailedError("Csound failed to render the patch.", {"return_code": str(process.returncode)})
        return Artifact(wav_path=output, spec_hash=patch_hash(patch), engine="csound7")
