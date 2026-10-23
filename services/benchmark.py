from concurrent.futures import ThreadPoolExecutor, as_completed
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
        result = query_runner(
            query=query_item["query"],
            api_key=api_key,
            model=model_id,
        )
        return {**identity, "status": "success", "result": result}
    except Exception as error:
        return {**identity, "status": "failed", "error": str(error)}


def run_parallel_benchmark(
    *,
    selected_models: dict[str, str],
    queries: list[dict[str, str]],
    api_key: str,
    query_runner: Callable[..., dict[str, Any]] = run_restaurant_query,
    max_workers: int = 10,
    on_result: Callable[[dict[str, Any], int, int], None] | None = None,
) -> list[dict[str, Any]]:
    """Run model-query jobs concurrently and return results in stable input order."""
    total = len(selected_models) * len(queries)
    results = []

    with ThreadPoolExecutor(max_workers=min(max_workers, total)) as executor:
        futures = {
            executor.submit(
                run_query_job,
                model_label=model_label,
                model_id=model_id,
                query_item=query_item,
                api_key=api_key,
                query_runner=query_runner,
            ): (model_label, query_item["id"])
            for model_label, model_id in selected_models.items()
            for query_item in queries
        }

        for completed, future in enumerate(as_completed(futures), start=1):
            result = future.result()
            results.append(result)
            if on_result:
                on_result(result, completed, total)

    model_order = {label: index for index, label in enumerate(selected_models)}
    query_order = {item["id"]: index for index, item in enumerate(queries)}
    return sorted(
        results,
        key=lambda item: (
            model_order[item["model_label"]],
            query_order[item["query_id"]],
        ),
    )
