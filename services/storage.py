import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


RUNS_DIRECTORY = Path(__file__).resolve().parents[1] / "data" / "runs"


def save_run(
    *,
    restaurant: dict[str, Any],
    models: dict[str, str],
    results: list[dict[str, Any]],
    scorecard: dict[str, Any],
) -> Path:
    RUNS_DIRECTORY.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc)
    run_id = timestamp.strftime("%Y%m%dT%H%M%SZ")
    path = RUNS_DIRECTORY / f"{run_id}.json"
    path.write_text(
        json.dumps(
            {
                "run_id": run_id,
                "created_at": timestamp.isoformat(),
                "restaurant": restaurant,
                "models": models,
                "results": results,
                "scorecard": scorecard,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return path
