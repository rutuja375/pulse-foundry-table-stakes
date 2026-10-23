from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from typing import Any, Callable

from services.openrouter import run_restaurant_query


RANKING_MODELS = {
    "OpenAI": "openai/gpt-5.2",
    "Gemini": "google/gemini-3.8-flash",
    "Claude": "anthropic/claude-sonnet-5",
    "Grok": "x-ai/grok-latest",
    "DeepSeek": "deepseek/deepseek-flash",
}


def run_model_benchmark(
    *,
    model_label: str,
    model_id: str,
    queries: list[dict[str, str]],
    api_key: str,
    query_runner: Callable[..., dict[str, Any]] = run_restaurant_query,
) -> list[dict[str, Any]]:
    results = []
    for query_item in queries:
        try:
            result = query_runner(
                query=query_item["query"],
                api_key=api_key,
                model=model_id,
            )
            results.append(
                {
                    "model_label": model_label,
                    "model_id": model_id,
                    "query_id": query_item["id"],
                    "category": query_item["category"],
                    "secondary_categories": query_item.get(
                        "secondary_categories", []
                    ),
                    "query": query_item["query"],
                    "status": "success",
                    "result": result,
                }
            )
        except Exception as error:
            results.append(
                {
                    "model_label": model_label,
                    "model_id": model_id,
                    "query_id": query_item["id"],
                    "category": query_item["category"],
                    "secondary_categories": query_item.get(
                        "secondary_categories", []
                    ),
                    "query": query_item["query"],
                    "status": "failed",
                    "error": str(error),
                }
            )
    return results


def run_query_job(
    *,
    model_label: str,
    model_id: str,
    query_item: dict[str, str],
    api_key: str,
    query_runner: Callable[..., dict[str, Any]] = run_restaurant_query,
) -> dict[str, Any]:
    identity = {
        "model_label": model_label,
        "model_id": model_id,
        "query_id": query_item["id"],
        "category": query_item["category"],
        "secondary_categories": query_item.get("secondary_categories", []),
        "query": query_item["query"],
    }
    try:
        runner_args = dict(
            query=query_item["query"],
            api_key=api_key,
            model=model_id,
        )
        if query_runner is not run_restaurant_query:
            runner_args["model_label"] = model_label
        result = query_runner(**runner_args)
        return {**identity, "status": "success", "result": result}
    except Exception as error:
        return {**identity, "status": "failed", "error": str(error)}


def run_parallel_benchmark(
    *,
    selected_models: dict[str, str],
    queries: list[dict[str, str]],
    api_key: str | None = None,
    api_keys: dict[str, str] | None = None,
    query_runner: Callable[..., dict[str, Any]] = run_restaurant_query,
    max_workers: int = 10,
    on_result: Callable[[dict[str, Any], int, int], None] | None = None,
) -> list[dict[str, Any]]:
    """Run models in parallel while each model processes its queries sequentially."""
    total = len(selected_models) * len(queries)
    results = []
    completed = 0
    progress_lock = Lock()

    def run_one_model(model_label: str, model_id: str) -> list[dict[str, Any]]:
        nonlocal completed
        model_results = []
        for query_item in queries:
            result = run_query_job(
                model_label=model_label,
                model_id=model_id,
                query_item=query_item,
                api_key=(api_keys or {}).get(model_label, api_key or ""),
                query_runner=query_runner,
            )
            model_results.append(result)
            if on_result:
                with progress_lock:
                    completed += 1
                    on_result(result, completed, total)
        return model_results

    worker_count = min(max_workers, len(selected_models))
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = {
            executor.submit(run_one_model, model_label, model_id): model_label
            for model_label, model_id in selected_models.items()
        }

        for future in as_completed(futures):
            results.extend(future.result())

    model_order = {label: index for index, label in enumerate(selected_models)}
    query_order = {item["id"]: index for index, item in enumerate(queries)}
    return sorted(
        results,
        key=lambda item: (
            model_order[item["model_label"]],
            query_order[item["query_id"]],
        ),
    )
