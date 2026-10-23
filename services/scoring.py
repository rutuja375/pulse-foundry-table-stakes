import re
import unicodedata
from collections import Counter
from typing import Any


TARGET_NAME = "Cafe Athena"
TARGET_ALIASES = {
    "cafe athena",
    "cafe athena restaurant",
    "cafe athena restaurant and bar",
    "cafe athena san diego",
}


def normalize_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name)
    normalized = "".join(
        character for character in normalized
        if not unicodedata.combining(character)
    )
    normalized = normalized.lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", " ", normalized).strip()


def is_target_name(name: str, target_name: str = TARGET_NAME) -> bool:
    normalized = normalize_name(name)
    aliases = set(TARGET_ALIASES)
    aliases.add(normalize_name(target_name))
    return normalized in aliases


def calculate_visibility(
    results: list[dict[str, Any]],
    target_name: str = TARGET_NAME,
) -> dict[str, Any]:
    successful_queries = 0
    target_mentions = 0
    target_positions: list[int] = []
    competitor_counts: Counter[str] = Counter()
    competitor_display_names: dict[str, str] = {}

    for item in results:
        if item.get("status") != "success":
            continue

        successful_queries += 1
        seen_target = False
        seen_competitors: set[str] = set()

        for recommendation in item["result"].get("recommendations", []):
            display_name = str(recommendation.get("restaurant", "")).strip()
            normalized_name = normalize_name(display_name)
            if not normalized_name:
                continue

            if is_target_name(display_name, target_name):
                if not seen_target:
                    target_mentions += 1
                    seen_target = True
                position = recommendation.get("position")
                if isinstance(position, int) and position > 0:
                    target_positions.append(position)
            elif normalized_name not in seen_competitors:
                competitor_counts[normalized_name] += 1
                competitor_display_names.setdefault(normalized_name, display_name)
                seen_competitors.add(normalized_name)

    mention_rate = (
        round(target_mentions / successful_queries * 100, 1)
        if successful_queries
        else 0.0
    )
    average_position = (
        round(sum(target_positions) / len(target_positions), 2)
        if target_positions
        else None
    )

    competitors = [
        {
            "name": competitor_display_names[name],
            "mentions": mentions,
            "mention_rate": round(mentions / successful_queries * 100, 1),
        }
        for name, mentions in competitor_counts.most_common()
    ]

    return {
        "successful_queries": successful_queries,
        "target_mentions": target_mentions,
        "mention_rate": mention_rate,
        "average_position": average_position,
        "competitors": competitors,
    }


def calculate_model_scorecards(
    results: list[dict[str, Any]],
    target_name: str = TARGET_NAME,
) -> dict[str, dict[str, Any]]:
    labels = dict.fromkeys(
        item["model_label"] for item in results if item.get("model_label")
    )
    return {
        label: calculate_visibility(
            [item for item in results if item.get("model_label") == label],
            target_name,
        )
        for label in labels
    }


def calculate_category_scorecards(
    results: list[dict[str, Any]],
    target_name: str = TARGET_NAME,
) -> dict[str, dict[str, Any]]:
    categories = sorted(
        {item["category"] for item in results if item.get("category")}
    )
    return {
        category: calculate_visibility(
            [item for item in results if item.get("category") == category],
            target_name,
        )
        for category in categories
    }


def calculate_query_consensus(
    results: list[dict[str, Any]],
    target_name: str = TARGET_NAME,
) -> list[dict[str, Any]]:
    query_ids = dict.fromkeys(
        item["query_id"] for item in results if item.get("query_id")
    )
    consensus = []

    for query_id in query_ids:
        query_results = [
            item for item in results
            if item.get("query_id") == query_id and item.get("status") == "success"
        ]
        target_models = []
        positions = {}

        for item in query_results:
            for recommendation in item["result"].get("recommendations", []):
                if is_target_name(recommendation.get("restaurant", ""), target_name):
                    target_models.append(item["model_label"])
                    positions[item["model_label"]] = recommendation.get("position")
                    break

        reporting_models = len(query_results)
        target_count = len(target_models)
        if reporting_models and target_count == reporting_models:
            agreement = "all_models_mention"
        elif target_count == 0:
            agreement = "no_models_mention"
        else:
            agreement = "models_disagree"

        first = next(item for item in results if item.get("query_id") == query_id)
        consensus.append(
            {
                "query_id": query_id,
                "category": first.get("category"),
                "query": first.get("query"),
                "successful_models": reporting_models,
                "target_mentions": target_count,
                "mention_rate": (
                    round(target_count / reporting_models * 100, 1)
                    if reporting_models else 0.0
                ),
                "models_mentioning_target": target_models,
                "positions": positions,
                "agreement": agreement,
            }
        )

    return consensus


def calculate_analytics(
    results: list[dict[str, Any]],
    target_name: str = TARGET_NAME,
) -> dict[str, Any]:
    return {
        "combined": calculate_visibility(results, target_name),
        "by_model": calculate_model_scorecards(results, target_name),
        "by_category": calculate_category_scorecards(results, target_name),
        "consensus": calculate_query_consensus(results, target_name),
    }
