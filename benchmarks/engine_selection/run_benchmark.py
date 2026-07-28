"""Runs every engine/case three times and records timing, hashes and render validity."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent
CASES = ("ui_click", "modal_impact", "continuous_engine", "polyphonic_instrument", "eight_bar_loop")
ROUTES = {
    "pyo": (ROOT / ".venv-pyo311" / "Scripts" / "python.exe", ROOT / "runners" / "runner_pyo.py"),
    "faust_dawdreamer": (ROOT / ".venv-dawdreamer" / "Scripts" / "python.exe", ROOT / "runners" / "runner_dawdreamer.py"),
    "csound7": (sys.executable, ROOT / "runners" / "runner_csound.py"),
}


def sha256(path: Path) -> str:
    return hashlib.file_digest(path.open("rb"), "sha256").hexdigest()


def inspect_wav(path: Path) -> dict[str, int]:
    sample_rate, data = wavfile.read(path)
    channels = 1 if data.ndim == 1 else data.shape[1]
    return {"channels": channels, "sample_rate": sample_rate, "frames": data.shape[0]}


def audio_sha256(path: Path) -> str:
    _, data = wavfile.read(path)
    return hashlib.sha256(data.tobytes()).hexdigest()


def run_route(route: str, case: str, run: int) -> dict[str, object]:
    python, runner = ROUTES[route]
    output = ROOT / "artifacts" / route / case / f"run-{run}.wav"
    command = [str(python), str(runner), case, str(output)]
    if route == "csound7":
        executable = next(iter((ROOT / "csound7-runtime").rglob("csound.exe")), None) if (ROOT / "csound7-runtime").exists() else None
        if executable is None:
            return {"route": route, "case": case, "run": run, "status": "blocked", "reason": "Csound 7 executable not installed in isolated runtime."}
        command += ["--csound", str(executable)]
    try:
        completed = subprocess.run(command, text=True, capture_output=True, check=True)
        metrics = json.loads(completed.stdout.strip().splitlines()[-1])
        metrics.update({"route": route, "run": run, "status": "ok", "sha256": sha256(output), "audio_sha256": audio_sha256(output), "wav": inspect_wav(output)})
        return metrics
    except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError) as error:
        return {"route": route, "case": case, "run": run, "status": "failed", "reason": str(error)}


def main() -> int:
    results = [run_route(route, case, run) for route in ROUTES for case in CASES for run in range(1, 4)]
    for route in ROUTES:
        for case in CASES:
            group = [item for item in results if item["route"] == route and item["case"] == case and item["status"] == "ok"]
            if group:
                hashes = {item["audio_sha256"] for item in group}
                for item in group:
                    item["deterministic"] = len(hashes) == 1
    (ROOT / "results" / "benchmark.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))
    return 0 if all(item["status"] in {"ok", "blocked"} for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
