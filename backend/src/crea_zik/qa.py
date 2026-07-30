from __future__ import annotations

from pathlib import Path
from uuid import UUID

from .audio_info import wav_info
from .models import QaReport


def evaluate_wav(artifact_id: UUID, path: Path, profile: str = "sfx", loop: bool = False) -> QaReport:
    info = wav_info(path)
    metrics = {
        "sample_peak": float(info["peak"]),
        "dc_offset": float(info["dc_offset"]),
        "rms": float(info["rms"]),
        "crest_factor": float(info["crest_factor"]),
        "stereo_correlation": float(info["stereo_correlation"]),
        "loop_value_delta": float(info["loop_value_delta"]),
        "loop_slope_delta": float(info["loop_slope_delta"]),
    }
    issues: list[str] = []
    if bool(info["is_clipping"]):
        issues.append("clipping")
    if abs(metrics["dc_offset"]) >= .02:
        issues.append("excessive_dc_offset")
    if bool(info["is_silent"]):
        issues.append("unexpected_silence")
    if loop and (metrics["loop_value_delta"] >= .01 or metrics["loop_slope_delta"] >= .02):
        issues.append("loop_discontinuity")
    return QaReport(artifact_id=artifact_id, profile=profile, passed=not issues, metrics=metrics, issues=issues)
