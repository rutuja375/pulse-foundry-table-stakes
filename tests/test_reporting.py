from services.reporting import filter_results, query_model_matrix


def sample_results():
    return [
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
                "recommendations": [{"restaurant": "Competitor", "position": 1}]
            },
        },
        {
            "model_label": "Gemini",
            "query_id": "q02",
            "category": "reservations",
            "query": "Where can I reserve?",
            "status": "failed",
            "error": "timeout",
        },
    ]


def test_query_model_matrix_distinguishes_rank_missing_and_failure():
    rows = query_model_matrix(sample_results())

    assert rows[0]["Gemini"] == "#2"
    assert rows[0]["Claude"] == "Not mentioned"
    assert rows[1]["Gemini"] == "Failed"


def test_filter_results_uses_model_and_category_dropdown_values():
    filtered = filter_results(
        sample_results(), model="Gemini", category="reservations"
    )

    assert len(filtered) == 1
    assert filtered[0]["query_id"] == "q02"
