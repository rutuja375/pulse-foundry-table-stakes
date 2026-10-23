import threading
import time

from services.benchmark import run_parallel_benchmark


def test_parallel_benchmark_preserves_model_and_query_identity():
    active_calls = 0
    maximum_active_calls = 0
    lock = threading.Lock()

    def fake_runner(*, query, api_key, model):
        nonlocal active_calls, maximum_active_calls
        with lock:
            active_calls += 1
            maximum_active_calls = max(maximum_active_calls, active_calls)
        time.sleep(0.01)
        with lock:
            active_calls -= 1
        return {"query": query, "recommendations": []}

    models = {"Model A": "provider/a", "Model B": "provider/b"}
    queries = [
        {
            "id": "q01",
            "category": "food",
            "secondary_categories": ["dietary"],
            "query": "Question one?",
        },
        {
            "id": "q02",
            "category": "events",
            "secondary_categories": [],
            "query": "Question two?",
        },
    ]

    results = run_parallel_benchmark(
        selected_models=models,
        queries=queries,
        api_key="test-key",
        query_runner=fake_runner,
    )

    assert len(results) == 4
    assert {item["model_label"] for item in results} == set(models)
    assert {item["query_id"] for item in results} == {"q01", "q02"}
    assert results[0]["secondary_categories"] == ["dietary"]
    assert maximum_active_calls >= 2


def test_parallel_benchmark_records_individual_failures():
    def fake_runner(*, query, api_key, model):
        if model == "provider/b":
            raise RuntimeError("provider unavailable")
        return {"query": query, "recommendations": []}

    results = run_parallel_benchmark(
        selected_models={"Model A": "provider/a", "Model B": "provider/b"},
        queries=[
            {
                "id": "q01",
                "category": "food",
                "secondary_categories": [],
                "query": "Question?",
            }
        ],
        api_key="test-key",
        query_runner=fake_runner,
    )

    statuses = {item["model_label"]: item["status"] for item in results}
    assert statuses == {"Model A": "success", "Model B": "failed"}
