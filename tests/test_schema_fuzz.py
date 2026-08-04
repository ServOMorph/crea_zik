import shutil
import tempfile
from pathlib import Path

import schemathesis
from crea_zik import api, cli
from crea_zik.api import app
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, settings
from schemathesis.checks import (
    content_type_conformance,
    response_schema_conformance,
    status_code_conformance,
)

READ_ONLY_ENDPOINTS = [
    "/api/health",
    "/api/gallery",
    "/api/composition-gallery",
    "/api/projects",
]

COMPOSITION_ENDPOINTS = [
    "/api/projects/{project_id}/compositions/{composition_id}",
    "/api/projects/{project_id}/compositions/{composition_id}/tracks",
    "/api/projects/{project_id}/compositions/{composition_id}/patterns",
    "/api/projects/{project_id}/compositions/{composition_id}/clips",
    "/api/projects/{project_id}/compositions/{composition_id}/automation",
    "/api/projects/{project_id}/compositions/{composition_id}/mixer",
    "/api/projects/{project_id}/compositions/{composition_id}/master",
]

schema = schemathesis.from_asgi(
    "/openapi.json",
    app,
    force_schema_version="30",
).include(path=READ_ONLY_ENDPOINTS, method="GET")

composition_schema = schemathesis.from_asgi(
    "/openapi.json",
    app,
    force_schema_version="30",
).include(path=COMPOSITION_ENDPOINTS, method="GET")


def _isolated_project_root() -> tuple[Path, Path, Path]:
    project_root = Path(tempfile.mkdtemp(prefix="crea-zik-schemafuzz-"))
    return project_root, api.PROJECT_ROOT, cli.PROJECT_ROOT


def _seed_composition_state(client: TestClient) -> tuple[str, str]:
    project = client.post("/api/projects", json={"name": "fuzz state"}).json()
    source = client.get("/api/composition-gallery").json()[0]
    composition = client.post(
        f"/api/projects/{project['id']}/compositions",
        json={"example_id": source["id"]},
    ).json()
    return project["id"], composition["id"]


@schema.parametrize()
@settings(max_examples=20, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_read_only_contract(case) -> None:
    project_root, original_api_root, original_cli_root = _isolated_project_root()
    api.PROJECT_ROOT = project_root
    cli.PROJECT_ROOT = project_root
    try:
        response = case.call_asgi()
        case.validate_response(
            response,
            checks=(status_code_conformance, content_type_conformance, response_schema_conformance),
        )
    finally:
        api.PROJECT_ROOT = original_api_root
        cli.PROJECT_ROOT = original_cli_root
        shutil.rmtree(project_root, ignore_errors=True)


@composition_schema.parametrize()
@settings(max_examples=10, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_composition_read_contract(case) -> None:
    project_root, original_api_root, original_cli_root = _isolated_project_root()
    api.PROJECT_ROOT = project_root
    cli.PROJECT_ROOT = project_root
    try:
        client = TestClient(app)
        project_id, composition_id = _seed_composition_state(client)
        case.path_parameters = {"project_id": project_id, "composition_id": composition_id}
        response = case.call_asgi()
        case.validate_response(
            response,
            checks=(status_code_conformance, content_type_conformance, response_schema_conformance),
        )
    finally:
        api.PROJECT_ROOT = original_api_root
        cli.PROJECT_ROOT = original_cli_root
        shutil.rmtree(project_root, ignore_errors=True)
