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
        waveform = round(self._parameter(patch, "waveform", 0, 0, 2)) + 1
        brightness = self._parameter(patch, "brightness", .6, 0, 1)
        drive = self._parameter(patch, "drive", 0, 0, 1)
        space = self._parameter(patch, "space", 0, 0, 1)
        delay_mix = self._parameter(patch, "delay_mix", 0, 0, 1)
        seed = patch.seed % 2_147_483_646 or 1
        if patch.kind is PatchKind.UI_CLICK:
            pitch = self._parameter(patch, "pitch_hz", 1700, 80, 12_000)
            source = f"aEnv linseg 0, .002, {patch.gain}, p3-.012, {patch.gain}*.1, .01, 0\naFm oscili {pitch}*{self._parameter(patch, 'fm_depth', .03, 0, 1)}, {pitch}*{self._parameter(patch, 'fm_ratio', 2, .1, 20)}, {waveform}\naSource oscili aEnv, {pitch}+aFm, {waveform}"
        elif patch.kind is PatchKind.MODAL_IMPACT:
            pitch = self._parameter(patch, "pitch_hz", 173, 30, 3_000)
            source = f"aEnv expon {patch.gain}, p3, .0001\na1 oscili aEnv, {pitch}, {waveform}\na2 oscili aEnv*.65, {pitch}*1.555, {waveform}\na3 oscili aEnv*.35, {pitch}*2.433, {waveform}\naSource = a1+a2+a3"
        elif patch.kind is PatchKind.WHOOSH:
            start = self._parameter(patch, "start_hz", 180, 20, 8_000)
            end = self._parameter(patch, "end_hz", 5_200, 20, 18_000)
            source = f"aEnv linseg 0, .01, {patch.gain}, p3-.02, {patch.gain}*.12, .01, 0\naFreq expon {start}, p3, {end}\naNoise noise aEnv*.7, {self._noise_beta(patch)}\naTone oscili aEnv*.5, aFreq, {waveform}\naSource = aNoise+aTone"
        elif patch.kind is PatchKind.MECHANICAL_AMBIENCE:
            density = self._parameter(patch, "density", 1, .2, 4)
            source = f"aLfo oscili {patch.gain}*.25, .17*{density}, 1\naNoise noise {patch.gain}*.2, {self._noise_beta(patch)}\na1 oscili {patch.gain}*.38, 47+aLfo*11, {waveform}\na2 oscili {patch.gain}*.24, 93+aLfo*17, {waveform}\na3 oscili {patch.gain}*.11, 181+aLfo*23, {waveform}\naSource = aNoise+a1+a2+a3"
        elif patch.kind is PatchKind.DRONE:
            pitch = self._parameter(patch, "pitch_hz", 55, 20, 800)
            movement = self._parameter(patch, "movement_hz", .12, .01, 20)
            source = f"aLfo oscili {patch.gain}*.3, {movement}, 1\naNoise noise {patch.gain}*.16, {self._noise_beta(patch)}\na1 oscili {patch.gain}*.45, {pitch}+aLfo, {waveform}\na2 oscili {patch.gain}*.3, {pitch}*.501+aLfo, {waveform}\naSource = aNoise+a1+a2"
        else:
            pitch = self._parameter(patch, "pitch_hz", 92, 20, 2_000)
            movement = self._parameter(patch, "movement_hz", .35, .01, 20)
            ring_depth = self._parameter(patch, "ring_depth", .25, 0, 1)
            source = f"aLfo oscili 18, {movement}, 1\naCarrier oscili {patch.gain}, {pitch}+aLfo, {waveform}\naRing oscili 1, {pitch}*{self._parameter(patch, 'ring_ratio', 1.5, .1, 20)}, {waveform}\naSource = aCarrier*((1-{ring_depth})+aRing*{ring_depth})"
        return "\n".join((
            f"seed {seed}",
            source,
            f"aLow butterlp aSource, {350 + brightness * 16_000}",
            "aHigh butterhp aLow, 20",
            f"aDriven = aHigh*(1+{drive}*4)",
            "aDelayRead delayr .45",
            "aDelayTap deltapi .17",
            f"delayw aDriven+aDelayTap*{delay_mix * .45}",
            f"aRoom reverb aDelayTap, {.15 + space * 2.5}",
            f"aMix = aDriven*(1-{space * .28})+aDelayTap*{delay_mix}+aRoom*{space * .35}",
            "kLow init -0.98",
            "kHigh init 0.98",
            "aSafe limit aMix, kLow, kHigh",
            "out aSafe, aSafe",
        ))

    def _noise_beta(self, patch: Patch) -> float:
        color = round(self._parameter(patch, "noise_color", 0, 0, 2))
        return (0, .72, .985)[color]

    @staticmethod
    def _parameter(patch: Patch, name: str, default: float, lower: float, upper: float) -> float:
        return min(upper, max(lower, patch.parameters.get(name, default)))

    def render(
        self,
        patch: Patch,
        output: Path,
        cancelled: Callable[[], bool] | None = None,
        progress: Callable[[int], None] | None = None,
    ) -> Artifact:
        output.parent.mkdir(parents=True, exist_ok=True)
        csd = output.with_suffix(".csd")
        csd.write_text("\n".join(("<CsoundSynthesizer>", "<CsOptions>", f'-d -W -o "{output}"', "</CsOptions>", "<CsInstruments>", f"sr=48000\nksmps=32\nnchnls=2\n0dbfs=1\ngi1 ftgen 1,0,16384,10,1\ngi2 ftgen 2,0,16384,7,0,4096,1,4096,0,4096,-1,4096,0\ngi3 ftgen 3,0,16384,10,1,.5,.333333,.25,.2,.166667,.142857,.125\ninstr 1\n{self._body(patch)}\nendin", "</CsInstruments>", "<CsScore>", f"i1 0 {patch.duration_seconds}", "</CsScore>", "</CsoundSynthesizer>")), encoding="utf-8")
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
