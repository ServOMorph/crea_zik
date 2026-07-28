"""Faust-through-DawDreamer offline renderer for the common benchmark cases."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import dawdreamer as daw
from scipy.io import wavfile

SAMPLE_RATE = 48_000


DSP = {
    "ui_click": """
        import(\"stdfaust.lib\");
        process = os.osc(1700.0) * 0.24 <: _, _;
    """,
    "modal_impact": """
        import(\"stdfaust.lib\");
        process = (os.osc(173.0) + 0.65 * os.osc(269.0) + 0.35 * os.osc(421.0) + 0.18 * os.osc(613.0)) * 0.16 <: _, _;
    """,
    "continuous_engine": """
        import(\"stdfaust.lib\");
        lfo = os.osc(0.35);
        freq = 92.0 + 18.0 * lfo;
        process = (os.osc(freq) + 0.22 * os.osc(freq * 2.01)) * 0.16 <: _, _;
    """,
    "polyphonic_instrument": """
        import(\"stdfaust.lib\");
        process = (os.osc(261.63) + os.osc(329.63) + os.osc(392.00) + os.osc(523.25)
                 + os.osc(659.25) + os.osc(783.99) + os.osc(987.77) + os.osc(1174.66)) * 0.035 <: _, _;
    """,
    "eight_bar_loop": """
        import(\"stdfaust.lib\");
        t = time / ma.SR;
        pulse = max(0.0, os.osc(2.0));
        melody = os.osc(261.63) + 0.6 * os.osc(329.63) + 0.4 * os.osc(392.0);
        bass = 0.55 * os.osc(65.41);
        process = (melody * pulse * 0.08 + bass * 0.11) <: _, _;
    """,
}

DURATIONS = {"ui_click": 0.12, "modal_impact": 1.25, "continuous_engine": 4.0,
             "polyphonic_instrument": 3.0, "eight_bar_loop": 16.0}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("case", choices=sorted(DSP))
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    engine = daw.RenderEngine(SAMPLE_RATE, 256)
    processor = engine.make_faust_processor(args.case)
    processor.set_dsp_string(DSP[args.case])
    engine.load_graph([(processor, [])])
    started = time.perf_counter()
    engine.render(DURATIONS[args.case])
    elapsed = time.perf_counter() - started
    wavfile.write(args.output, SAMPLE_RATE, engine.get_audio().transpose())
    print(json.dumps({"engine": "faust_dawdreamer", "case": args.case, "seconds": elapsed, "sample_rate": SAMPLE_RATE}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
