from __future__ import annotations

import json
import logging
from typing import Any


LOGGER = logging.getLogger("crea_zik")


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")


def log_event(event: str, **fields: Any) -> None:
    LOGGER.info(json.dumps({"event": event, **fields}, ensure_ascii=False, sort_keys=True, default=str))
