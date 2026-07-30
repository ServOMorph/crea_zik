import shutil
import tempfile
from pathlib import Path

import schemathesis
from crea_zik import api, cli
from crea_zik.api import app
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

schema = schemathesis.from_asgi(
    "/openapi.json",
    app,
    force_schema_version="30",
).include(path=READ_ONLY_ENDPOINTS, method="GET")


@schema.parametrize()
@settings(max_examples=20, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_read_only_contract(case) -> None:
    project_root = Path(tempfile.mkdtemp(prefix="crea-zik-schemafuzz-"))
    original_api_root = api.PROJECT_ROOT
    original_cli_root = cli.PROJECT_ROOT
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
