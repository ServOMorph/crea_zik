from __future__ import annotations

from uuid import UUID

from .models import Patch, PatchKind


def examples() -> list[Patch]:
    return [
        Patch(id=UUID("b0c1c1c0-0000-4000-8000-000000000001"), name="Clic tactile", kind=PatchKind.UI_CLICK, seed=101, duration_seconds=.12, gain=.18),
        Patch(id=UUID("b0c1c1c0-0000-4000-8000-000000000002"), name="Validation lumineuse", kind=PatchKind.UI_CLICK, seed=102, duration_seconds=.18, gain=.22),
        Patch(id=UUID("b0c1c1c0-0000-4000-8000-000000000003"), name="Erreur sourde", kind=PatchKind.MODAL_IMPACT, seed=103, duration_seconds=.45, gain=.15),
    ]
