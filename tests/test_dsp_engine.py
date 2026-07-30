from crea_zik.engine import CsoundEngine
from crea_zik.models import Patch, PatchKind


def test_dsp_body_is_seeded_and_bounded_for_each_family() -> None:
    engine = object.__new__(CsoundEngine)
    for kind in PatchKind:
        patch = Patch(
            name=kind.value,
            kind=kind,
            seed=42,
            duration_seconds=.2,
            parameters={"brightness": 9, "drive": -3, "noise_color": 7},
        )
        body = engine._body(patch)
        assert "seed 42" in body
        assert "butterlp" in body
        assert "delayr" in body
        assert "reverb" in body
        assert "aSafe limit aMix, kLow, kHigh" in body


def test_noise_color_is_clamped_to_supported_values() -> None:
    engine = object.__new__(CsoundEngine)
    patch = Patch(name="noise", kind=PatchKind.WHOOSH, seed=1, duration_seconds=.2, parameters={"noise_color": 99})
    assert engine._noise_beta(patch) == .985
