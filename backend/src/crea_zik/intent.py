from __future__ import annotations

from .models import IntentProposal, Patch, Project


def preview_proposal(project: Project, proposal: IntentProposal) -> Project:
    updated = project.model_copy(deep=True)
    for operation in proposal.operations:
        index = next((index for index, patch in enumerate(updated.patches) if patch.id == operation.patch_id), None)
        if index is None:
            raise ValueError("proposal references an unknown patch")
        patch = updated.patches[index]
        payload = patch.model_dump()
        if operation.path.startswith("parameters."):
            parameter = operation.path.removeprefix("parameters.")
            parameters = dict(patch.parameters)
            parameters[parameter] = operation.value
            payload["parameters"] = parameters
        else:
            payload[operation.path] = operation.value
        updated.patches[index] = Patch.model_validate(payload)
    return updated
