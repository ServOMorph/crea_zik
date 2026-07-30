from __future__ import annotations

import json
import os
from urllib.error import URLError
from urllib.request import Request, urlopen

from .intent import IntentProposal
from .models import Project


class OllamaProposalError(RuntimeError):
    pass


def generate_proposal(project: Project, intent: str, timeout_seconds: int = 60) -> IntentProposal:
    if not intent.strip():
        raise ValueError("intent must not be blank")
    payload = json.dumps(
        {
            "model": os.environ.get("OLLAMA_MODEL", "qwen2.5:7b"),
            "stream": False,
            "format": "json",
            "prompt": _prompt(project, intent),
        }
    ).encode("utf-8")
    request = Request("http://127.0.0.1:11434/api/generate", data=payload, headers={"Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            body = json.load(response)
    except (URLError, TimeoutError) as error:
        raise OllamaProposalError("Ollama is unavailable") from error
    response = body.get("response") if isinstance(body, dict) else None
    if not isinstance(response, str):
        raise OllamaProposalError("Ollama returned an empty proposal")
    try:
        return IntentProposal.model_validate(_normalize_response(response, project))
    except ValueError as error:
        raise OllamaProposalError("Ollama returned an invalid proposal") from error


def _normalize_response(response: str, project: Project) -> dict[str, object]:
    data = json.loads(response)
    if not isinstance(data, dict):
        raise ValueError("proposal must be an object")
    operations = data.get("operations")
    if not isinstance(operations, list):
        raise ValueError("proposal has no operations")
    for operation in operations:
        if not isinstance(operation, dict):
            raise ValueError("proposal operation is invalid")
        path = operation.get("path")
        if not isinstance(path, str):
            raise ValueError("proposal path is invalid")
        if "patch_id" not in operation:
            if len(project.patches) != 1 or not path.startswith("/"):
                raise ValueError("proposal patch target is ambiguous")
            operation["patch_id"] = str(project.patches[0].id)
        if path.startswith("/"):
            operation["path"] = path.removeprefix("/").replace("/", ".")
    return data


def _prompt(project: Project, intent: str) -> str:
    patches = [
        {
            "id": str(patch.id),
            "name": patch.name,
            "kind": patch.kind,
            "gain": patch.gain,
            "duration_seconds": patch.duration_seconds,
            "parameters": patch.parameters,
        }
        for patch in project.patches
    ]
    return (
        "Return one JSON object only, with intent, rationale, expected_impacts and operations. "
        "rationale is a concise French justification. expected_impacts is a list of at most five concise French impacts. "
        "Rationale and impacts must concern audio rendering or project parameters only: never mention visuals, UI aesthetics, hardware, battery, users, or devices. "
        "Each operation must use op=replace and one existing patch id. "
        "Allowed paths: gain, duration_seconds, favorite, notes, tags, parameters.<macro>. "
        "Never create paths, commands, code, files, URLs, or unknown fields. "
        f"User intent: {intent}\nPatches: {json.dumps(patches, ensure_ascii=False)}"
    )
