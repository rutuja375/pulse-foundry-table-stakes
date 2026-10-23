import json
from pathlib import Path

from services.recommendations import build_aiso_recommendations


BASELINE_PATH = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "runs"
    / "20261023T194307Z.json"
)


def test_static_baseline_keeps_expected_provider_results():
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    successful = {
        model: len(
            [
                item
                for item in baseline["results"]
                if item["model_label"] == model and item["status"] == "success"
            ]
        )
        for model in ("OpenAI", "Gemini", "Claude")
    }

    assert successful == {"OpenAI": 20, "Gemini": 20, "Claude": 15}


def test_recommendations_prioritize_zero_visibility_and_preserve_evidence():
    results = [
        {
            "status": "success",
            "category": "happy_hour",
            "secondary_categories": [],
            "result": {
                "recommendations": [
                    {
                        "restaurant": "Competitor One",
                        "reason": "Publishes happy-hour times and prices.",
                        "source_urls": ["https://example.com/happy-hour"],
                    }
                ]
            },
        }
    ]
    analytics = {
        "by_category": {
            "happy_hour": {
                "successful_queries": 1,
                "target_mentions": 0,
                "mention_rate": 0.0,
                "average_position": None,
            }
        }
    }

    report = build_aiso_recommendations(results, analytics)
    recommendation = report["category_recommendations"][0]

    assert recommendation["priority"] == "High"
    assert recommendation["competitors"][0]["restaurant"] == "Competitor One"
    assert recommendation["competitors"][0]["source_urls"] == [
        "https://example.com/happy-hour"
    ]
    assert recommendation["recommended_changes"]
