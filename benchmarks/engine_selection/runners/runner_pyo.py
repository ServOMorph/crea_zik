"""Offline pyo renderer used only by the engine-selection benchmark."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from pyo import Delay, Fader, Sine, SineLoop, Server

SAMPLE_RATE = 48_000


def add_note(mix, start: float, frequency: float, duration: float, gain: float = 0.10):
    envelope = Fader(fadein=0.008, fadeout=0.12, dur=duration, mul=gain)
    voice = Sine(freq=frequency, mul=envelope)
    return mix + Delay(voice, delay=start)


def build_case(case: str):
    if case == "ui_click":
        duration = 0.12
        envelope = Fader(fadein=0.001, fadeout=0.11, dur=duration, mul=0.22)
        return SineLoop(freq=1_700, feedback=0.04, mul=envelope), duration
    if case == "modal_impact":
        duration = 1.25
        envelope = Fader(fadein=0.002, fadeout=1.15, dur=duration, mul=0.18)
        modes = Sine(freq=[173, 269, 421, 613], mul=envelope).mix(2)
        return modes, duration
    if case == "continuous_engine":
        duration = 4.0
        envelope = Fader(fadein=0.05, fadeout=0.18, dur=duration, mul=0.16)
        rotor = Sine(freq=0.35, mul=18, add=92)
        return SineLoop(freq=rotor, feedback=0.12, mul=envelope).mix(2), duration
    if case == "polyphonic_instrument":
        duration = 3.0
        output = Sine(freq=1, mul=0)
        for start, note in ((0, 261.63), (0.12, 329.63), (0.24, 392.00), (0.36, 523.25),
                            (0.48, 659.25), (0.60, 783.99), (0.72, 987.77), (0.84, 1_174.66)):
            output = add_note(output, start, note, 1.7)
        return output.mix(2), duration
    if case == "eight_bar_loop":
        duration = 16.0  # eight 4/4 bars at 120 BPM
        output = Sine(freq=1, mul=0)
        scale = (261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 329.63, 293.66)
        for beat in range(32):
            output = add_note(output, beat * 0.5, scale[beat % len(scale)], 0.42, 0.075)
        return output.mix(2), duration
    raise ValueError(f"Unknown case: {case}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("case")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    server = Server(sr=SAMPLE_RATE, nchnls=2, buffersize=256, audio="offline").boot()
    signal, duration = build_case(args.case)
    started = time.perf_counter()
    server.recordOptions(dur=duration, filename=str(args.output), fileformat=0, sampletype=3)
    signal.out()
    server.start()
    elapsed = time.perf_counter() - started
    server.shutdown()
    print(json.dumps({"engine": "pyo", "case": args.case, "seconds": elapsed, "sample_rate": SAMPLE_RATE}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
