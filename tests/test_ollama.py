from __future__ import annotations

import json

from crea_zik.models import Patch, PatchKind, Project
import pytest

from crea_zik.ollama import OllamaProposalError, _normalize_response, generate_proposal


class FakeResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self.payload = payload

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def read(self, *_: object) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


def test_ollama_generator_accepts_only_schema_valid_json(monkeypatch) -> None:
    patch = Patch(name="click", kind=PatchKind.UI_CLICK, seed=1, duration_seconds=.1)
    response = {"response": json.dumps({"intent": "brighter", "operations": [{"op": "replace", "patch_id": str(patch.id), "path": "parameters.brightness", "value": .8}]})}
    monkeypatch.setattr("crea_zik.ollama.urlopen", lambda *_args, **_kwargs: FakeResponse(response))

    proposal = generate_proposal(Project(name="demo", patches=[patch]), "make it brighter")

    assert proposal.operations[0].path == "parameters.brightness"


def test_ollama_normalizes_a_single_patch_json_patch_response() -> None:
    patch = Patch(name="click", kind=PatchKind.UI_CLICK, seed=1, duration_seconds=.1)
    response = json.dumps({"intent": "brighter", "operations": [{"op": "replace", "path": "/parameters/brightness", "value": .8}]})

    normalized = _normalize_response(response, Project(name="demo", patches=[patch]))

    assert normalized["operations"][0]["patch_id"] == str(patch.id)
    assert normalized["operations"][0]["path"] == "parameters.brightness"


def test_ollama_rejects_ambiguous_or_hostile_targets(monkeypatch) -> None:
    first = Patch(name="first", kind=PatchKind.UI_CLICK, seed=1, duration_seconds=.1)
    second = Patch(name="second", kind=PatchKind.UI_CLICK, seed=2, duration_seconds=.1)
    ambiguous = {"response": json.dumps({"intent": "ambiguous", "operations": [{"op": "replace", "path": "/parameters/brightness", "value": 1}]})}
    monkeypatch.setattr("crea_zik.ollama.urlopen", lambda *_args, **_kwargs: FakeResponse(ambiguous))

    with pytest.raises(OllamaProposalError):
        generate_proposal(Project(name="demo", patches=[first, second]), "do anything")

    hostile = {"response": json.dumps({"intent": "hostile", "operations": [{"op": "replace", "patch_id": str(first.id), "path": "/../../outside", "value": 1}]})}
    monkeypatch.setattr("crea_zik.ollama.urlopen", lambda *_args, **_kwargs: FakeResponse(hostile))

    with pytest.raises(OllamaProposalError):
        generate_proposal(Project(name="demo", patches=[first]), "do anything")
