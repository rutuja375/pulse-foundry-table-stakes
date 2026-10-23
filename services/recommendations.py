from collections import Counter
from typing import Any

from services.scoring import is_target_name, normalize_name


CATEGORY_ACTIONS = {
    "affordability": [
        "Publish a readable lunch menu with current prices and an explicit price range.",
        "Create a short 'affordable lunch in Pacific Beach' section with representative meals and prices.",
    ],
    "catering": [
        "Create a dedicated catering page with platter and boxed-lunch options, minimum order, lead time, delivery area, and inquiry link.",
        "Clearly label gluten-free, vegetarian, and vegan catering choices.",
    ],
    "date_night": [
        "Create a date-night page describing the atmosphere, cocktails, dinner service, and reservation link.",
        "Add current interior, evening, cocktail, and shareable-plate photos with descriptive alt text.",
    ],
    "dietary_options": [
        "Label vegetarian, vegan, and gluten-free items directly in the HTML menu.",
        "Add a dietary-options FAQ explaining substitutions and cross-contact limitations.",
    ],
    "greek_food": [
        "Strengthen the homepage and menu language around authentic Greek food in Pacific Beach.",
        "Create individual, indexable pages or sections for signature Greek dishes with descriptions and photos.",
    ],
    "happy_hour": [
        "Create a dedicated happy-hour page listing days, exact times, drinks, food specials, and prices.",
        "Keep the same happy-hour details consistent on Google Business Profile and major restaurant directories.",
    ],
    "mediterranean_food": [
        "Clearly describe Café Athena as a Greek and Mediterranean restaurant in Pacific Beach on the homepage.",
        "Add Mediterranean menu categories and ingredient descriptions as readable webpage text.",
    ],
    "private_events": [
        "Create a private-events page covering rehearsal dinners, birthdays, capacity, layouts, menus, and inquiry steps.",
        "Show evidence for groups of 10 and 25, including whether one-table seating is available.",
    ],
    "reservations": [
        "Add a prominent reservation button and state which booking platform is used.",
        "Add reservation information to Restaurant structured data and keep it consistent across profiles.",
    ],
    "table_size": [
        "Publish group-seating details, maximum table size, and when a private-room booking is unnecessary.",
        "Add a group reservation FAQ with contact and confirmation steps.",
    ],
}


FOUNDATION_ACTIONS = [
    "Add Restaurant, Menu, FAQPage, and Event structured data where applicable, including address, cuisine, price range, opening hours, reservations, and menu URL.",
    "Keep the restaurant name, address, hours, menu, and service claims consistent across the website, Google Business Profile, Yelp, TripAdvisor, reservation platforms, and local directories.",
    "Use crawlable HTML for important facts instead of placing essential menu or service information only in images or PDFs.",
]


def _category_results(results: list[dict[str, Any]], category: str) -> list[dict[str, Any]]:
    return [
        item
        for item in results
        if item.get("category") == category
        or category in item.get("secondary_categories", [])
    ]


def _competitor_evidence(items: list[dict[str, Any]], limit: int = 5) -> list[dict[str, Any]]:
    counts: Counter[str] = Counter()
    display_names: dict[str, str] = {}
    reasons: dict[str, list[str]] = {}
    sources: dict[str, list[str]] = {}

    for item in items:
        if item.get("status") != "success":
            continue
        seen = set()
        for recommendation in item["result"].get("recommendations", []):
            name = str(recommendation.get("restaurant", "")).strip()
            normalized = normalize_name(name)
            if not normalized or is_target_name(name) or normalized in seen:
                continue
            seen.add(normalized)
            counts[normalized] += 1
            display_names.setdefault(normalized, name)
            reason = str(recommendation.get("reason", "")).strip()
            if reason and reason not in reasons.setdefault(normalized, []):
                reasons[normalized].append(reason)
            for url in recommendation.get("source_urls", []):
                if url not in sources.setdefault(normalized, []):
                    sources[normalized].append(url)

    return [
        {
            "restaurant": display_names[name],
            "mentions": count,
            "evidence_reasons": reasons.get(name, [])[:2],
            "source_urls": sources.get(name, [])[:5],
        }
        for name, count in counts.most_common(limit)
    ]


def build_aiso_recommendations(
    results: list[dict[str, Any]], analytics: dict[str, Any]
) -> dict[str, Any]:
    categories = []
    for category, scorecard in analytics["by_category"].items():
        competitors = _competitor_evidence(_category_results(results, category))
        mention_rate = scorecard["mention_rate"]
        if mention_rate == 0:
            priority = "High"
        elif mention_rate < 50:
            priority = "Medium"
        else:
            priority = "Protect"
        categories.append(
            {
                "category": category,
                "priority": priority,
                "cafe_athena_mentions": scorecard["target_mentions"],
                "successful_responses": scorecard["successful_queries"],
                "mention_rate": mention_rate,
                "average_position": scorecard["average_position"],
                "competitors": competitors,
                "recommended_changes": CATEGORY_ACTIONS.get(category, []),
            }
        )

    priority_order = {"High": 0, "Medium": 1, "Protect": 2}
    categories.sort(
        key=lambda item: (priority_order[item["priority"]], item["mention_rate"])
    )
    return {
        "basis": "Static three-model baseline: 20 prompts for OpenAI, Gemini, and Claude.",
        "method": "Priorities are based on Café Athena's category mention rate. Competitor examples, reasons, and URLs come directly from the saved model responses.",
        "foundation_actions": FOUNDATION_ACTIONS,
        "category_recommendations": categories,
    }
