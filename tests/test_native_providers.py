import pytest

from services.native_providers import ProviderError, extract_json, normalize_result


def test_extract_json_accepts_markdown_fence():
    assert extract_json('```json\n{"recommendations": []}\n```') == {
        "recommendations": []
    }


def test_normalize_result_adds_stable_fields():
    result = normalize_result(
        '{"recommendations": [{"restaurant": "Cafe Athena"}]}',
        "Where should we eat?",
        "test-model",
    )
    recommendation = result["recommendations"][0]
    assert recommendation["position"] == 1
    assert recommendation["source_urls"] == []
    assert result["query"] == "Where should we eat?"


def test_extract_json_rejects_non_json():
    with pytest.raises(ProviderError):
        extract_json("No structured response")
