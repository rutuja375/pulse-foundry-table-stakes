#!/usr/bin/env python3
"""
Build the demo payload the display renders.

The display reads ONE file — `data/runs/demo-cafe-athena.json` — and it has to be
a real backend run, not a fixture invented for the screen. This script takes a
stored run and does exactly three things to it:

  1. copies `results` and `scorecard` unchanged — the answers and the backend's
     own numbers are never touched, so the mention rate in the report is theirs;
  2. stamps provenance (`demo`, `demo_note`, `source_run`) so the report's
     "How this was read" block says this is a stored snapshot;
  3. refuses to write if the scorecard disagrees with the answers it ships.

Usage:
    python3 scripts/build-demo.py SOURCE_RUN.json [--note "..."] [--out path]
"""

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_OUT = REPO / "data" / "runs" / "demo-cafe-athena.json"


def norm(value: str) -> str:
    value = unicodedata.normalize("NFD", value)
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9 ]", " ", value.lower().replace("&", " and ")).strip()


def audit(run: dict) -> dict:
    """Recount from the answers and compare with the scorecard we are shipping."""
    target = norm((run.get("restaurant") or {}).get("name") or "")
    results = run.get("results") or []
    successful = [row for row in results if row.get("status") == "success"]

    mentions, positions = 0, []
    for row in successful:
        for recommendation in (row.get("result") or {}).get("recommendations") or []:
            if target and target in norm(str(recommendation.get("restaurant") or "")):
                mentions += 1
                position = recommendation.get("position")
                if isinstance(position, int):
                    positions.append(position)

    combined = ((run.get("scorecard") or {}).get("combined") or {})
    return {
        "requested": len(results),
        "successful": len(successful),
        "failed": len(results) - len(successful),
        "mentions": mentions,
        "average_position": round(sum(positions) / len(positions), 2) if positions else None,
        "reported_mentions": combined.get("target_mentions"),
        "reported_successful": combined.get("successful_queries"),
        "reported_average_position": combined.get("average_position"),
        "questions": len({row.get("query_id") for row in results}),
        "assistants": len(run.get("models") or {}),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument(
        "--note",
        default=None,
        help="Sentence(s) shown in the report's 'How this was read' block.",
    )
    args = parser.parse_args()

    run = json.loads(args.source.read_text())
    facts = audit(run)

    # The whole point of shipping a demo subset is that its numbers are the
    # backend's. If they are not, the file is wrong and shipping it would put a
    # figure in front of an owner that nothing in the payload supports.
    mismatches = []
    if facts["reported_mentions"] not in (None, facts["mentions"]):
        mismatches.append(f"scorecard says {facts['reported_mentions']} mentions, answers give {facts['mentions']}")
    if facts["reported_successful"] not in (None, facts["successful"]):
        mismatches.append(
            f"scorecard says {facts['reported_successful']} successful, payload has {facts['successful']}"
        )
    if mismatches:
        print("refusing to write:", "; ".join(mismatches), file=sys.stderr)
        return 1

    note = args.note or (
        f"Demo dataset: a stored run ({run.get('run_id')}), not a live one. "
        f"All {facts['questions']} questions, {facts['successful']} scored answers across "
        f"{facts['assistants']} assistants; {facts['failed']} calls failed and are shown as absent, "
        "not as refusals. The mention rate and average position are the backend's own scoring."
    )

    payload = {
        "run_id": f"demo-{str(run.get('created_at') or '')[:10]}",
        "created_at": run.get("created_at"),
        "restaurant": run.get("restaurant"),
        "models": run.get("models"),
        "results": run.get("results"),
        "scorecard": run.get("scorecard"),
        "demo": True,
        "demo_note": note,
        "source_run": run.get("run_id"),
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")

    print(f"wrote {args.out.relative_to(REPO)}")
    print(
        f"  {facts['questions']} questions · {facts['successful']}/{facts['requested']} answered · "
        f"{facts['assistants']} assistants · {facts['mentions']} target mentions · "
        f"avg position {facts['average_position']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
