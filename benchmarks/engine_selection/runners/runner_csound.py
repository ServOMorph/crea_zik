"""Csound 7 runner. It accepts an explicit executable to keep installation isolated."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

SAMPLE_RATE = 48_000
DURATIONS = {"ui_click": 0.12, "modal_impact": 1.25, "continuous_engine": 4.0,
             "polyphonic_instrument": 3.0, "eight_bar_loop": 16.0}


def orchestra(case: str) -> str:
    if case == "ui_click":
        body = "a1 expon .23, p3, .0001\n a2 oscili a1, 1700, 1\n outs a2, a2"
    elif case == "modal_impact":
        body = "a1 expon .18, p3, .0001\n a2 oscili a1, 173, 1\n a3 oscili a1*.65, 269, 1\n a4 oscili a1*.35, 421, 1\n outs a2+a3+a4, a2+a3+a4"
    elif case == "continuous_engine":
        body = "aLfo oscili 18, .35, 1\n a1 oscili .16, 92+aLfo, 1\n outs a1, a1"
    elif case == "polyphonic_instrument":
        body = "a1 linen .03, .01, p3, .2\n a2 oscili a1, p4, 1\n outs a2, a2"
    else:
        body = "a1 oscili .1, p4, 1\n outs a1, a1"
    return f"""sr = {SAMPLE_RATE}\nksmps = 32\nnchnls = 2\n0dbfs = 1\ngi1 ftgen 1, 0, 16384, 10, 1\ninstr 1\n{body}\nendin\n"""


def score(case: str, duration: float) -> str:
    if case == "polyphonic_instrument":
        return "\n".join(f"i1 {index * .12:.2f} 1.7 {note}" for index, note in enumerate((261.63, 329.63, 392, 523.25, 659.25, 783.99, 987.77, 1174.66)))
    if case == "eight_bar_loop":
        notes = (261.63, 293.66, 329.63, 392, 440, 392, 329.63, 293.66)
        return "\n".join(f"i1 {beat * .5:.2f} .42 {notes[beat % 8]}" for beat in range(32))
    return f"i1 0 {duration}" 


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("case", choices=sorted(DURATIONS))
    parser.add_argument("output", type=Path)
    parser.add_argument("--csound", default=None)
    args = parser.parse_args()
    executable = args.csound or shutil.which("csound")
    if not executable:
        raise RuntimeError("Csound 7 executable unavailable; pass --csound with an isolated install path.")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    csd = args.output.with_suffix(".csd")
    csd.write_text(
        "\n".join((
            "<CsoundSynthesizer>",
            "<CsOptions>",
            f'-d -W -o "{args.output}"',
            "</CsOptions>",
            "<CsInstruments>",
            orchestra(args.case),
            "</CsInstruments>",
            "<CsScore>",
            score(args.case, DURATIONS[args.case]),
            "</CsScore>",
            "</CsoundSynthesizer>",
        )),
        encoding="utf-8",
    )
    started = time.perf_counter()
    subprocess.run([executable, str(csd)], check=True)
    elapsed = time.perf_counter() - started
    print(json.dumps({"engine": "csound7", "case": args.case, "seconds": elapsed, "sample_rate": SAMPLE_RATE}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
