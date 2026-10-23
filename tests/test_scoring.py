from services.scoring import (
    calculate_analytics,
    calculate_visibility,
    is_target_name,
    normalize_name,
)


def test_normalize_name_handles_accents_and_punctuation():
    assert normalize_name("Café Athena") == "cafe athena"
    assert normalize_name("Joe’s Pizza – PB") == "joe s pizza pb"


def test_target_aliases_match_common_cafe_athena_names():
    assert is_target_name("Café Athena")
    assert is_target_name("Cafe Athena Restaurant and Bar")
    assert not is_target_name("Athena Grill")


def test_calculate_visibility_counts_once_per_query():
    results = [
        {
            "status": "success",
            "result": {
                "recommendations": [
                    {"restaurant": "Competitor A", "position": 1},
                    {"restaurant": "Café Athena", "position": 2},
                ]
            },
        },
        {
            "status": "success",
            "result": {
                "recommendations": [
                    {"restaurant": "Competitor A", "position": 1},
                    {"restaurant": "Competitor B", "position": 2},
                ]
            },
        },
        {"status": "failed", "error": "ignored"},
    ]

    scorecard = calculate_visibility(results)

    assert scorecard["successful_queries"] == 2
    assert scorecard["target_mentions"] == 1
    assert scorecard["mention_rate"] == 50.0
    assert scorecard["average_position"] == 2.0
    assert scorecard["competitors"][0]["name"] == "Competitor A"
    assert scorecard["competitors"][0]["mentions"] == 2


def test_analytics_separates_models_categories_and_consensus():
    results = [
        {
            "model_label": "Gemini",
            "query_id": "q01",
            "category": "greek_food",
            "query": "Best Greek food?",
            "status": "success",
            "result": {
                "recommendations": [{"restaurant": "Cafe Athena", "position": 2}]
            },
        },
        {
            "model_label": "Claude",
            "query_id": "q01",
            "category": "greek_food",
            "query": "Best Greek food?",
            "status": "success",
            "result": {
                "recommendations": [{"restaurant": "Competitor A", "position": 1}]
            },
        },
    ]

    analytics = calculate_analytics(results)

    assert analytics["combined"]["mention_rate"] == 50.0
    assert analytics["by_model"]["Gemini"]["mention_rate"] == 100.0
    assert analytics["by_model"]["Claude"]["mention_rate"] == 0.0
    assert analytics["by_category"]["greek_food"]["mention_rate"] == 50.0
    assert analytics["consensus"][0]["agreement"] == "models_disagree"
