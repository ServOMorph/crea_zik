from __future__ import annotations

from typing import Mapping

from .models import ErrorDetail


class CreaZikError(ValueError):
    code = "internal_error"

    def __init__(self, message: str, details: Mapping[str, str] | None = None) -> None:
        super().__init__(message)
        self.details = dict(details or {})

    def to_detail(self) -> ErrorDetail:
        return ErrorDetail(code=self.code, message=str(self), details=self.details)


class ProjectPathError(CreaZikError):
    code = "project_path_invalid"


class PatchNotFoundError(CreaZikError):
    code = "patch_not_found"


class RenderEngineUnavailableError(CreaZikError):
    code = "render_engine_unavailable"


class RenderTimeoutError(CreaZikError):
    code = "render_timeout"


class RenderFailedError(CreaZikError):
    code = "render_failed"


class ExportArtifactMissingError(CreaZikError):
    code = "export_artifact_missing"


class ArtifactMissingError(CreaZikError):
    code = "artifact_missing"


def error_detail(error: Exception) -> ErrorDetail:
    if isinstance(error, CreaZikError):
        return error.to_detail()
    if isinstance(error, ValueError):
        return ErrorDetail(code="validation_error", message="Command input is invalid.")
    return ErrorDetail(code="internal_error", message="An unexpected internal error occurred.")
