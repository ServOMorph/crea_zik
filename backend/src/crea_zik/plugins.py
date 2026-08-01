from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
from types import ModuleType

from jsonschema import Draft202012Validator

_DEFAULT_REPO_ROOT = Path(__file__).resolve().parents[3]
_REPO_ROOT = Path(os.environ.get("CREA_ZIK_REPO_ROOT", _DEFAULT_REPO_ROOT))
EXPLO_PLUGINS_ROOT = _REPO_ROOT / "EXPLO" / "plugins"
PLUGIN_SCHEMA_PATH = EXPLO_PLUGINS_ROOT / "schema" / "plugin_manifest.schema.json"

_engine_modules: dict[str, ModuleType] = {}


def _plugin_directory(plugin_id: str) -> Path:
    return EXPLO_PLUGINS_ROOT / plugin_id


def list_plugin_ids() -> list[str]:
    if not EXPLO_PLUGINS_ROOT.exists():
        return []
    return sorted(path.parent.name for path in EXPLO_PLUGINS_ROOT.glob("*/manifest.json"))


def load_manifest(plugin_id: str) -> dict:
    manifest_path = _plugin_directory(plugin_id) / "manifest.json"
    if not manifest_path.is_file():
        raise ValueError(f"plugin inconnu: {plugin_id}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    schema = json.loads(PLUGIN_SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(manifest)
    return manifest


def load_presets(plugin_id: str) -> dict[str, dict]:
    presets_path = _plugin_directory(plugin_id) / "presets.json"
    if not presets_path.is_file():
        raise ValueError(f"plugin inconnu: {plugin_id}")
    return json.loads(presets_path.read_text(encoding="utf-8"))


def load_engine_module(plugin_id: str) -> ModuleType:
    if plugin_id in _engine_modules:
        return _engine_modules[plugin_id]
    engine_path = _plugin_directory(plugin_id) / "engine.py"
    if not engine_path.is_file():
        raise ValueError(f"plugin inconnu: {plugin_id}")
    spec = importlib.util.spec_from_file_location(f"crea_zik_plugin_{plugin_id}", engine_path)
    if spec is None or spec.loader is None:
        raise ValueError(f"moteur illisible pour le plugin: {plugin_id}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _engine_modules[plugin_id] = module
    return module


def resolve_params(plugin_id: str, preset: str, overrides: dict[str, object]) -> dict[str, object]:
    presets = load_presets(plugin_id)
    if preset not in presets:
        raise ValueError(f"preset inconnu: {preset}")
    params = dict(presets[preset])
    unknown = set(overrides) - set(params)
    if unknown:
        raise ValueError(f"paramètres inconnus: {', '.join(sorted(unknown))}")
    params.update(overrides)
    return params


def render_plugin(plugin_id: str, params: dict[str, object], velocity: float):
    manifest = load_manifest(plugin_id)
    engine_module = load_engine_module(plugin_id)
    sample_rate = manifest["engine"]["sample_rate"]
    audio = engine_module.render(params, velocity, sample_rate)
    return audio, sample_rate
