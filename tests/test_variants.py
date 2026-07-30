from crea_zik.models import Patch, PatchKind
from crea_zik.variants import vary_patch


def test_variants_are_seeded_and_preserve_locked_macros() -> None:
    patch = Patch(
        name="source",
        kind=PatchKind.WHOOSH,
        seed=12,
        duration_seconds=.4,
        parameters={"pitch_hz": 400, "brightness": .6, "space": .2},
    )
    ranges = {"pitch_hz": (.8, 1.2), "brightness": (-.2, .2), "space": (-.2, .2)}

    first = vary_patch(patch, 13, {"brightness"}, ranges)
    second = vary_patch(patch, 13, {"brightness"}, ranges)

    assert first == second
    assert first.seed == 13
    assert first.parameters["brightness"] == patch.parameters["brightness"]
    assert first.parameters["pitch_hz"] != patch.parameters["pitch_hz"]


def test_variants_clamp_unit_interval_macros() -> None:
    patch = Patch(name="source", kind=PatchKind.UI_CLICK, seed=1, duration_seconds=.2, parameters={"drive": 1})
    variant = vary_patch(patch, 2, set(), {"drive": (-.1, .7)})
    assert 0 <= variant.parameters["drive"] <= 1
