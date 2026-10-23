import re
import unicodedata
from collections import Counter
from typing import Any


TARGET_NAME = "Cafe Athena"


def normalize_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name)
    normalized = "".join(
        character for character in normalized
        if not unicodedata.combining(character)
    )
    normalized = normalized.lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", " ", normalized).strip()


def calculate_visibility(
    results: list[dict[str, Any]],
    target_name: str = TARGET_NAME,
) -> dict[str, Any]:
    target = normalize_name(target_name)
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

            if normalized_name == target:
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
