from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]


def read_json(relative_path: str) -> dict[str, object]:
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


def test_lignes_de_nuit_target_composition_matches_the_contract() -> None:
    schema = read_json("EDITEUR/contracts/composition.schema.json")
    composition = read_json("EDITEUR/fixtures/lignes_de_nuit.composition.json")
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(
        validator.iter_errors(composition), key=lambda error: list(error.path)
    )
    assert not errors, "\n".join(error.message for error in errors)


def test_lignes_de_nuit_uses_stable_unique_identifiers_and_complete_tracks() -> None:
    composition = read_json("EDITEUR/fixtures/lignes_de_nuit.composition.json")
    tracks = composition["tracks"]
    patterns = composition["patterns"]
    clips = composition["clips"]
    identifiers = [composition["id"]]
    identifiers.extend(track["id"] for track in tracks)
    identifiers.extend(pattern["id"] for pattern in patterns)
    identifiers.extend(clip["id"] for clip in clips)
    assert len(identifiers) == len(set(identifiers))
    for identifier in identifiers:
        UUID(identifier)
    assert {track["name"] for track in tracks} == {
        "drums",
        "bass",
        "pad",
        "arp",
        "lead",
    }
    assert {pattern["track_id"] for pattern in patterns} == {
        track["id"] for track in tracks
    }


def test_lignes_de_nuit_golden_contains_every_rendered_stem() -> None:
    golden = read_json("EDITEUR/fixtures/lignes_de_nuit.golden.json")
    assert set(golden["stems_sha256"]) == {"drums", "bass", "pad", "arp", "lead"}
    assert golden["audio"]["sample_rate"] == 48000
    assert golden["audio"]["channels"] == 2
    assert golden["audio"]["duration_seconds"] == 30.0
