from __future__ import annotations

import math

from crea_zik.effect_registry import (
    EFFECT_KINDS,
    default_parameters_for_kind,
    registry_payload,
    sanitize_effect_parameters,
)
from hypothesis import given
from hypothesis import strategies as st


def test_registry_payload_covers_every_effect_kind() -> None:
    payload = registry_payload()
    assert set(payload) == set(EFFECT_KINDS)
    for kind in EFFECT_KINDS:
        assert "groups" in payload[kind]
        assert "defaults" in payload[kind]


def test_default_parameters_for_kind_returns_independent_copies() -> None:
    first = default_parameters_for_kind("eq")
    second = default_parameters_for_kind("eq")
    first["freq_hz"] = 1
    assert second["freq_hz"] != 1


def test_sanitize_clamps_out_of_range_values() -> None:
    sanitized = sanitize_effect_parameters(
        "eq", {"freq_hz": 999_999, "gain_db": -999, "q": 0}
    )
    assert sanitized["freq_hz"] == 20000
    assert sanitized["gain_db"] == -24
    assert sanitized["q"] == 0.1


def test_sanitize_replaces_non_finite_values_with_default() -> None:
    sanitized = sanitize_effect_parameters(
        "compressor",
        {
            "threshold_db": math.nan,
            "ratio": math.inf,
            "attack_ms": -math.inf,
            "release_ms": 50,
        },
    )
    defaults = default_parameters_for_kind("compressor")
    assert sanitized["threshold_db"] == defaults["threshold_db"]
    assert sanitized["ratio"] == defaults["ratio"]
    assert sanitized["attack_ms"] == defaults["attack_ms"]
    assert sanitized["release_ms"] == 50


def test_sanitize_unknown_kind_returns_parameters_unchanged() -> None:
    parameters = {"anything": 1}
    assert sanitize_effect_parameters("unknown", parameters) == parameters


@given(
    freq_hz=st.floats(allow_nan=True, allow_infinity=True, width=32),
    gain_db=st.floats(allow_nan=True, allow_infinity=True, width=32),
    q=st.floats(allow_nan=True, allow_infinity=True, width=32),
)
def test_sanitize_always_returns_finite_bounded_eq_parameters(
    freq_hz: float, gain_db: float, q: float
) -> None:
    sanitized = sanitize_effect_parameters(
        "eq", {"freq_hz": freq_hz, "gain_db": gain_db, "q": q}
    )
    assert 20 <= sanitized["freq_hz"] <= 20000
    assert -24 <= sanitized["gain_db"] <= 24
    assert 0.1 <= sanitized["q"] <= 10
