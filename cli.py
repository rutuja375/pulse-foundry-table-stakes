import argparse
import getpass
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from services.benchmark import RANKING_MODELS, run_parallel_benchmark
from services.native_providers import MODEL_KEY_ENV, NATIVE_MODELS, run_native_query
from services.openrouter import OpenRouterError, run_restaurant_query, validate_api_key
from services.scoring import calculate_analytics, is_target_name


ROOT = Path(__file__).resolve().parent
QUERY_BANK_PATH = ROOT / "data" / "query_bank.json"
EXPORT_DIRECTORY = ROOT / "data" / "exports"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run the Cafe Athena multi-model visibility benchmark."
    )
    parser.add_argument(
        "--provider",
        choices=["native", "openrouter"],
        default="native",
        help="Use direct provider APIs (default) or the OpenRouter fallback.",
    )
    parser.add_argument(
        "--models",
        nargs="+",
        default=None,
        help="Model labels to run. Defaults to all available for the provider.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Run only the first N prompts for a quick test.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=6,
        help="Maximum concurrent API calls. Defaults to 6.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional output JSON path.",
    )
    return parser.parse_args()


def target_position(result):
    if result["status"] != "success":
        return None
    for recommendation in result["result"].get("recommendations", []):
        if is_target_name(recommendation.get("restaurant", "")):
            return recommendation.get("position")
    return None


def main():
    load_dotenv()
    args = parse_args()
    available_models = NATIVE_MODELS if args.provider == "native" else RANKING_MODELS
    model_labels = args.models or list(available_models)
    unknown = [label for label in model_labels if label not in available_models]
    if unknown:
        raise SystemExit(f'Unknown model(s) for {args.provider}: {", ".join(unknown)}')

    api_key = ""
    api_keys = None
    query_runner = run_native_query
    if args.provider == "native":
        api_keys = {label: os.getenv(MODEL_KEY_ENV[label], "") for label in model_labels}
        missing = [label for label, key in api_keys.items() if not key]
        if missing:
            env_names = ", ".join(MODEL_KEY_ENV[label] for label in missing)
            raise SystemExit(f"Missing environment variable(s): {env_names}")
    else:
        query_runner = run_restaurant_query
        api_key = os.getenv("OPENROUTER_API_KEY") or getpass.getpass(
            "OpenRouter API key (input hidden): "
        )
        try:
            validate_api_key(api_key)
        except OpenRouterError as error:
            raise SystemExit(str(error)) from error

    queries = json.loads(QUERY_BANK_PATH.read_text(encoding="utf-8"))
    if args.limit:
        if args.limit < 1:
            raise SystemExit("--limit must be at least 1")
        queries = queries[: args.limit]
    selected_models = {label: available_models[label] for label in model_labels}
    total = len(queries) * len(selected_models)

    print(
        f"Running {len(queries)} prompts across {len(selected_models)} models "
        f"({total} requests, up to {args.workers} concurrently).",
        flush=True,
    )

    def print_result(result, completed, total_jobs):
        if result["status"] == "success":
            position = target_position(result)
            visibility = f"Cafe Athena #{position}" if position else "Cafe Athena absent"
            message = f"OK | {visibility}"
        else:
            message = f'FAILED | {result["error"]}'
        print(
            f'[{completed:>3}/{total_jobs}] {result["model_label"]:<8} '
            f'{result["query_id"]}: {message}',
            flush=True,
        )

    results = run_parallel_benchmark(
        selected_models=selected_models,
        queries=queries,
        api_key=api_key,
        api_keys=api_keys,
        query_runner=query_runner,
        max_workers=args.workers,
        on_result=print_result,
    )
    analytics = calculate_analytics(results)
    timestamp = datetime.now(timezone.utc)
    payload = {
        "created_at": timestamp.isoformat(),
        "target": "Cafe Athena",
        "models": selected_models,
        "queries": queries,
        "results": results,
        "analytics": analytics,
    }

    output_path = args.output
    if output_path is None:
        EXPORT_DIRECTORY.mkdir(parents=True, exist_ok=True)
        output_path = EXPORT_DIRECTORY / timestamp.strftime(
            "cafe-athena-results-%Y%m%dT%H%M%SZ.json"
        )
    else:
        output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print("\nVisibility summary")
    for model, scorecard in analytics["by_model"].items():
        print(
            f'- {model}: {scorecard["mention_rate"]}% mention rate; '
            f'average position {scorecard["average_position"] or "not ranked"}'
        )
    print(f"\nBackend JSON saved to: {output_path.resolve()}")


if __name__ == "__main__":
    main()
