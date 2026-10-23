import json
from pathlib import Path


QUERY_BANK_PATH = Path(__file__).resolve().parents[1] / "data" / "query_bank.json"


def test_query_bank_has_twenty_valid_unique_prompts():
    queries = json.loads(QUERY_BANK_PATH.read_text(encoding="utf-8"))

    assert len(queries) == 20
    assert len({item["id"] for item in queries}) == 20
    assert all(item["category"].strip() for item in queries)
    assert all(item["query"].strip().endswith("?") for item in queries)


def test_query_bank_contains_requested_categories():
    queries = json.loads(QUERY_BANK_PATH.read_text(encoding="utf-8"))
    categories = {item["category"] for item in queries}

    assert {"reservations", "pet_friendly", "table_size", "service_speed"} <= categories
