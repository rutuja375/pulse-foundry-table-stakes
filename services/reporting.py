from typing import Any

from services.scoring import TARGET_NAME, is_target_name


def model_scorecard_rows(analytics: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "Model": model,
            "Successful prompts": scorecard["successful_queries"],
            "Cafe Athena mentions": scorecard["target_mentions"],
            "Mention rate (%)": scorecard["mention_rate"],
            "Average position": scorecard["average_position"],
        }
        for model, scorecard in analytics["by_model"].items()
    ]


def category_scorecard_rows(analytics: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "Category": category,
            "Successful responses": scorecard["successful_queries"],
            "Cafe Athena mentions": scorecard["target_mentions"],
            "Mention rate (%)": scorecard["mention_rate"],
            "Average position": scorecard["average_position"],
        }
        for category, scorecard in analytics["by_category"].items()
    ]


def query_model_matrix(
    results: list[dict[str, Any]],
    target_name: str = TARGET_NAME,
) -> list[dict[str, Any]]:
    queries: dict[str, dict[str, Any]] = {}

    for item in results:
        row = queries.setdefault(
            item["query_id"],
            {
                "Query ID": item["query_id"],
                "Category": item["category"],
                "Question": item["query"],
            },
        )
        model = item["model_label"]
        if item["status"] != "success":
            row[model] = "Failed"
            continue

        position = None
        for recommendation in item["result"].get("recommendations", []):
            if is_target_name(recommendation.get("restaurant", ""), target_name):
                position = recommendation.get("position")
                break
        row[model] = f"#{position}" if position else "Not mentioned"

    return list(queries.values())


def filter_results(
    results: list[dict[str, Any]],
    *,
    model: str = "All models",
    category: str = "All categories",
) -> list[dict[str, Any]]:
    return [
        item
        for item in results
        if (model == "All models" or item.get("model_label") == model)
        and (category == "All categories" or item.get("category") == category)
    ]
