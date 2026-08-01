from __future__ import annotations

import os
from pathlib import Path
from uuid import UUID

from .models import Composition, Patch, PatchKind

_DEFAULT_REPO_ROOT = Path(__file__).resolve().parents[3]


def examples() -> list[Patch]:
    return [
        Patch(id=UUID("b0c1c1c0-0000-4000-8000-000000000001"), name="Clic tactile", kind=PatchKind.UI_CLICK, seed=101, duration_seconds=.12, gain=.18, parameters={"brightness": .85, "fm_depth": .04}),
        Patch(id=UUID("b0c1c1c0-0000-4000-8000-000000000002"), name="Validation lumineuse", kind=PatchKind.UI_CLICK, seed=102, duration_seconds=.18, gain=.22, parameters={"pitch_hz": 2300, "brightness": .9, "space": .08}),
        Patch(id=UUID("b0c1c1c0-0000-4000-8000-000000000003"), name="Erreur sourde", kind=PatchKind.MODAL_IMPACT, seed=103, duration_seconds=.45, gain=.15, parameters={"pitch_hz": 105, "brightness": .18}),
        Patch(id=UUID("b0c1c1c0-0000-4000-8000-000000000004"), name="Impact métallique", kind=PatchKind.MODAL_IMPACT, seed=104, duration_seconds=.65, gain=.21, parameters={"pitch_hz": 210, "drive": .12, "space": .2}),
        Patch(id=UUID("b0c1c1c0-0000-4000-8000-000000000005"), name="Whoosh de transition", kind=PatchKind.WHOOSH, seed=105, duration_seconds=.8, gain=.14, parameters={"start_hz": 160, "end_hz": 6800, "noise_color": 1, "brightness": .9}),
        Patch(id=UUID("b0c1c1c0-0000-4000-8000-000000000006"), name="Moteur science-fiction", kind=PatchKind.ENGINE, seed=106, duration_seconds=2.4, gain=.16, parameters={"pitch_hz": 84, "movement_hz": .48, "ring_depth": .32, "drive": .08}),
        Patch(id=UUID("b0c1c1c0-0000-4000-8000-000000000007"), name="Ambiance mécanique", kind=PatchKind.MECHANICAL_AMBIENCE, seed=107, duration_seconds=3, gain=.12, parameters={"density": 1.7, "noise_color": 2, "brightness": .35, "delay_mix": .22}),
    ]


def composition_examples() -> list[Composition]:
    repo_root = Path(os.environ.get("CREA_ZIK_REPO_ROOT", _DEFAULT_REPO_ROOT))
    source = repo_root / "EDITEUR" / "fixtures" / "lignes_de_nuit.composition.json"
    return [Composition.model_validate_json(source.read_text(encoding="utf-8"))]


def composition_example(example_id: UUID) -> Composition | None:
    return next((item for item in composition_examples() if item.id == example_id), None)
