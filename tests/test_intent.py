from uuid import uuid4

import pytest
from pydantic import ValidationError

from crea_zik.intent import preview_proposal
from crea_zik.models import IntentProposal, ProposalOperation
from crea_zik.models import Patch, PatchKind, Project


def test_proposal_previews_only_allowed_patch_fields() -> None:
    patch = Patch(name="click", kind=PatchKind.UI_CLICK, seed=1, duration_seconds=.1, gain=.2)
    project = Project(name="demo", patches=[patch])
    proposal = IntentProposal(
        intent="make it brighter",
        operations=[ProposalOperation(op="replace", patch_id=patch.id, path="parameters.brightness", value=.8)],
    )

    preview = preview_proposal(project, proposal)

    assert project.patches[0].parameters == {}
    assert preview.patches[0].parameters == {"brightness": .8}


def test_proposal_rejects_paths_and_invalid_values() -> None:
    patch = Patch(name="click", kind=PatchKind.UI_CLICK, seed=1, duration_seconds=.1)
    with pytest.raises(ValidationError):
        ProposalOperation(op="replace", patch_id=patch.id, path="../engine", value="run")
    proposal = IntentProposal(
        intent="break it",
        operations=[ProposalOperation(op="replace", patch_id=uuid4(), path="gain", value=.2)],
    )
    with pytest.raises(ValueError, match="unknown patch"):
        preview_proposal(Project(name="demo", patches=[patch]), proposal)
