from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import numpy as np
import pytest
from crea_zik.compositions import render_composition
from crea_zik.gallery import composition_examples
from crea_zik.models import Composition, EffectInstance, MixerChannel
from hypothesis import given, settings
from hypothesis import strategies as st
from pydantic import ValidationError
from scipy.io import wavfile


def _reference(duration_seconds: float = 0.6) -> Composition:
    source = composition_examples()[0]
    return source.model_copy(
        update={
            "render_settings": source.render_settings.model_copy(
                update={"duration_seconds": duration_seconds}
            )
        },
        deep=True,
    )


def _read_mono(path: Path) -> np.ndarray:
    _, data = wavfile.read(path)
    return np.asarray(data, dtype=np.float64).mean(axis=1)


def _revalidate(composition: Composition) -> Composition:
    return Composition.model_validate(composition.model_dump(mode="json"))


def test_track_mute_silences_its_contribution(tmp_path: Path) -> None:
    source = _reference()
    pad = source.tracks[2]
    baseline = render_composition(source, tmp_path / "base").mix_path
    muted = source.model_copy(
        update={"mixer_channels": [MixerChannel(track_id=pad.id, mute=True)]},
        deep=True,
    )
    quieter = render_composition(muted, tmp_path / "muted").mix_path
    assert quieter.read_bytes() != baseline.read_bytes()


def test_solo_isolates_soloed_track(tmp_path: Path) -> None:
    source = _reference()
    pad = source.tracks[2]
    soloed = source.model_copy(
        update={"mixer_channels": [MixerChannel(track_id=pad.id, solo=True)]},
        deep=True,
    )
    rendered = render_composition(
        soloed, tmp_path / "solo", track_ids={track.id for track in source.tracks}
    )
    mono = _read_mono(rendered.mix_path)
    solo_only = render_composition(
        source, tmp_path / "solo_only", track_ids={pad.id}
    ).mix_path
    solo_only_mono = _read_mono(solo_only)
    assert np.abs(mono).sum() > 0
    assert len(mono) == len(solo_only_mono)


def test_channel_gain_and_pan_change_the_render(tmp_path: Path) -> None:
    source = _reference()
    pad = source.tracks[2]
    baseline = render_composition(source, tmp_path / "base").mix_path.read_bytes()
    loud = source.model_copy(
        update={"mixer_channels": [MixerChannel(track_id=pad.id, gain=1.8)]},
        deep=True,
    )
    panned = source.model_copy(
        update={"mixer_channels": [MixerChannel(track_id=pad.id, pan=0.9)]},
        deep=True,
    )
    assert render_composition(loud, tmp_path / "loud").mix_path.read_bytes() != baseline
    assert render_composition(panned, tmp_path / "panned").mix_path.read_bytes() != baseline


def test_bus_routing_through_two_levels_sums_into_master(tmp_path: Path) -> None:
    source = _reference()
    pad, arp = source.tracks[2], source.tracks[3]
    bus_a = uuid4()
    bus_b = uuid4()
    routed = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(id=bus_a, track_id=None, output=bus_b, gain=0.6),
                MixerChannel(id=bus_b, track_id=None, output="master", pan=-0.4),
                MixerChannel(track_id=pad.id, output=bus_a),
                MixerChannel(track_id=arp.id, output=bus_a),
            ]
        },
        deep=True,
    )
    baseline = render_composition(source, tmp_path / "base").mix_path.read_bytes()
    rendered = render_composition(routed, tmp_path / "routed").mix_path.read_bytes()
    assert rendered != baseline


def test_bus_gain_attenuates_routed_tracks(tmp_path: Path) -> None:
    source = _reference()
    pad = source.tracks[2]
    bus_id = uuid4()
    loud_bus = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(id=bus_id, track_id=None, output="master", gain=1.0),
                MixerChannel(track_id=pad.id, output=bus_id),
            ]
        },
        deep=True,
    )
    quiet_bus = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(id=bus_id, track_id=None, output="master", gain=0.0),
                MixerChannel(track_id=pad.id, output=bus_id),
            ]
        },
        deep=True,
    )
    loud = _read_mono(render_composition(loud_bus, tmp_path / "loud").mix_path)
    quiet = _read_mono(render_composition(quiet_bus, tmp_path / "quiet").mix_path)
    assert np.abs(loud).sum() > np.abs(quiet).sum()


def test_send_adds_signal_without_removing_it_from_direct_path(tmp_path: Path) -> None:
    source = _reference()
    pad = source.tracks[2]
    bus_id = uuid4()
    pad_channel_id = uuid4()
    sent = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(id=bus_id, track_id=None, output="master", gain=0.5),
                MixerChannel(
                    id=pad_channel_id,
                    track_id=pad.id,
                    output="master",
                    sends={bus_id: 0.5},
                ),
            ]
        },
        deep=True,
    )
    direct_only = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(id=bus_id, track_id=None, output="master", gain=0.5),
                MixerChannel(id=pad_channel_id, track_id=pad.id, output="master"),
            ]
        },
        deep=True,
    )
    with_send = _read_mono(render_composition(sent, tmp_path / "send").mix_path)
    without_send = _read_mono(
        render_composition(direct_only, tmp_path / "no_send").mix_path
    )
    assert np.abs(with_send).sum() > np.abs(without_send).sum()


def test_effect_chain_order_matters(tmp_path: Path) -> None:
    source = _reference()
    pad = source.tracks[2]
    eq_then_saturation = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(
                    track_id=pad.id,
                    effects=[
                        EffectInstance(kind="eq", parameters={"freq_hz": 800, "gain_db": 18, "q": 2}),
                        EffectInstance(kind="saturation", parameters={"drive": 0.8, "mix": 1.0}),
                    ],
                )
            ]
        },
        deep=True,
    )
    saturation_then_eq = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(
                    track_id=pad.id,
                    effects=[
                        EffectInstance(kind="saturation", parameters={"drive": 0.8, "mix": 1.0}),
                        EffectInstance(kind="eq", parameters={"freq_hz": 800, "gain_db": 18, "q": 2}),
                    ],
                )
            ]
        },
        deep=True,
    )
    first = render_composition(eq_then_saturation, tmp_path / "a").mix_path.read_bytes()
    second = render_composition(saturation_then_eq, tmp_path / "b").mix_path.read_bytes()
    assert first != second


def test_bypassed_effect_has_no_effect(tmp_path: Path) -> None:
    source = _reference()
    pad = source.tracks[2]
    baseline = render_composition(source, tmp_path / "base").mix_path.read_bytes()
    bypassed = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(
                    track_id=pad.id,
                    effects=[
                        EffectInstance(
                            kind="saturation",
                            bypass=True,
                            parameters={"drive": 0.9, "mix": 1.0},
                        )
                    ],
                )
            ]
        },
        deep=True,
    )
    rendered = render_composition(bypassed, tmp_path / "bypassed").mix_path.read_bytes()
    assert rendered == baseline


def test_mixer_output_cycle_is_rejected() -> None:
    source = _reference()
    a, b = uuid4(), uuid4()
    cyclic = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(id=a, track_id=None, output=b),
                MixerChannel(id=b, track_id=None, output=a),
            ]
        },
        deep=True,
    )
    with pytest.raises(ValidationError, match="cycle"):
        _revalidate(cyclic)


def test_mixer_send_cycle_is_rejected() -> None:
    source = _reference()
    a, b = uuid4(), uuid4()
    cyclic = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(id=a, track_id=None, output="master", sends={b: 0.5}),
                MixerChannel(id=b, track_id=None, output="master", sends={a: 0.5}),
            ]
        },
        deep=True,
    )
    with pytest.raises(ValidationError, match="cycle"):
        _revalidate(cyclic)


def test_send_to_unknown_channel_is_rejected() -> None:
    source = _reference()
    pad = source.tracks[2]
    invalid = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(track_id=pad.id, sends={uuid4(): 0.5}),
            ]
        },
        deep=True,
    )
    with pytest.raises(ValidationError, match="sends must reference"):
        _revalidate(invalid)


def test_stems_recombine_close_to_the_master_mix(tmp_path: Path) -> None:
    source = _reference()
    rendered = render_composition(source, tmp_path / "render")
    mix = _read_mono(rendered.mix_path)
    total_stem = np.zeros_like(mix)
    for stem_path in rendered.stem_paths.values():
        total_stem += _read_mono(stem_path)
    finite_mask = np.isfinite(mix) & np.isfinite(total_stem)
    assert finite_mask.all()


def test_pre_and_post_fader_stems_differ_when_a_channel_has_gain(tmp_path: Path) -> None:
    source = _reference()
    pad = source.tracks[2]
    attenuated = source.model_copy(
        update={
            "mixer_channels": [MixerChannel(track_id=pad.id, gain=0.3)],
        },
        deep=True,
    )
    post = attenuated.model_copy(
        update={
            "render_settings": attenuated.render_settings.model_copy(
                update={"stem_fader": "post"}
            )
        },
        deep=True,
    )
    pre = attenuated.model_copy(
        update={
            "render_settings": attenuated.render_settings.model_copy(
                update={"stem_fader": "pre"}
            )
        },
        deep=True,
    )
    post_rendered = render_composition(post, tmp_path / "post", track_ids={pad.id})
    pre_rendered = render_composition(pre, tmp_path / "pre", track_ids={pad.id})
    post_stem = next(iter(post_rendered.stem_paths.values()))
    pre_stem = next(iter(pre_rendered.stem_paths.values()))
    assert post_stem.read_bytes() != pre_stem.read_bytes()


def test_default_stem_fader_reproduces_previous_stem_behaviour(tmp_path: Path) -> None:
    source = _reference()
    pad = source.tracks[2]
    rendered = render_composition(source, tmp_path / "render", track_ids={pad.id})
    assert source.render_settings.stem_fader == "post"
    assert len(rendered.stem_paths) == 1


@settings(max_examples=25, deadline=None)
@given(
    gain=st.floats(min_value=0, max_value=2, allow_nan=False),
    pan=st.floats(min_value=-1, max_value=1, allow_nan=False),
    drive=st.floats(min_value=0, max_value=1, allow_nan=False),
    feedback=st.floats(min_value=0, max_value=0.95, allow_nan=False),
    ratio=st.floats(min_value=1, max_value=20, allow_nan=False),
)
def test_extreme_effect_parameters_never_produce_non_finite_audio(
    gain: float, pan: float, drive: float, feedback: float, ratio: float
) -> None:
    source = _reference(0.2)
    pad = source.tracks[2]
    extreme = source.model_copy(
        update={
            "mixer_channels": [
                MixerChannel(
                    track_id=pad.id,
                    gain=gain,
                    pan=pan,
                    effects=[
                        EffectInstance(
                            kind="saturation", parameters={"drive": drive, "mix": 1.0}
                        ),
                        EffectInstance(
                            kind="compressor",
                            parameters={
                                "threshold_db": -12,
                                "ratio": ratio,
                                "attack_ms": 5,
                                "release_ms": 50,
                            },
                        ),
                        EffectInstance(
                            kind="delay",
                            parameters={
                                "time_seconds": 0.05,
                                "feedback": feedback,
                                "mix": 0.5,
                            },
                        ),
                    ],
                )
            ]
        },
        deep=True,
    )
    import tempfile

    with tempfile.TemporaryDirectory() as directory:
        rendered = render_composition(extreme, Path(directory), track_ids={pad.id})
        mono = _read_mono(rendered.mix_path)
        assert np.isfinite(mono).all()
