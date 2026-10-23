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
                    "query": query_item["query"],
                    "status": "failed",
                    "error": str(error),
                }
            )
    return results


def run_parallel_benchmark(
    *,
    selected_models: dict[str, str],
    queries: list[dict[str, str]],
    api_key: str,
    query_runner: Callable[..., dict[str, Any]] = run_restaurant_query,
) -> list[dict[str, Any]]:
    """Run one independent worker per model; each worker runs the same query bank."""
    results_by_model: dict[str, list[dict[str, Any]]] = {}

    with ThreadPoolExecutor(max_workers=len(selected_models)) as executor:
        futures = {
            executor.submit(
                run_model_benchmark,
                model_label=model_label,
                model_id=model_id,
                queries=queries,
                api_key=api_key,
                query_runner=query_runner,
            ): model_label
            for model_label, model_id in selected_models.items()
        }

        for future in as_completed(futures):
            model_label = futures[future]
            results_by_model[model_label] = future.result()

    return [
        result
        for model_label in selected_models
        for result in results_by_model[model_label]
    ]
