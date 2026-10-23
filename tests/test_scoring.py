from services.scoring import calculate_visibility, normalize_name


def test_normalize_name_handles_accents_and_punctuation():
    assert normalize_name("Café Athena") == "cafe athena"
    assert normalize_name("Joe’s Pizza – PB") == "joe s pizza pb"


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
