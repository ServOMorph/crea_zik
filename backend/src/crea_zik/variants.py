from __future__ import annotations

from random import Random

from .models import Patch

DEFAULT_RANGES: dict[str, tuple[float, float]] = {
    "pitch_hz": (.82, 1.18),
    "brightness": (-.18, .18),
    "drive": (-.12, .12),
    "space": (-.18, .18),
    "delay_mix": (-.18, .18),
    "density": (.8, 1.25),
    "movement_hz": (.8, 1.25),
    "fm_depth": (.7, 1.3),
    "ring_depth": (-.18, .18),
}


def vary_patch(patch: Patch, seed: int, locked_parameters: set[str], ranges: dict[str, tuple[float, float]]) -> Patch:
    random = Random(seed)
    parameters = dict(patch.parameters)
    for name, (lower, upper) in ranges.items():
        if name in locked_parameters or name not in parameters:
            continue
        value = parameters[name]
        if name in {"brightness", "drive", "space", "delay_mix", "ring_depth", "fm_depth"}:
            parameters[name] = min(1, max(0, value + random.uniform(lower, upper)))
        else:
            parameters[name] = max(.001, value * random.uniform(lower, upper))
    return patch.model_copy(update={"parameters": parameters, "seed": seed})
