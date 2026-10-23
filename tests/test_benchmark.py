import threading
import time

from services.benchmark import run_parallel_benchmark


def test_parallel_benchmark_preserves_model_and_query_identity():
    active_calls = 0
    maximum_active_calls = 0
    lock = threading.Lock()

    def fake_runner(*, query, api_key, model, model_label):
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
    def fake_runner(*, query, api_key, model, model_label):
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


def test_parallel_benchmark_uses_each_models_own_api_key():
    observed = {}

    def fake_runner(*, query, api_key, model, model_label):
        observed[model_label] = api_key
        return {"query": query, "recommendations": []}

    run_parallel_benchmark(
        selected_models={"OpenAI": "gpt-test", "Gemini": "gemini-test"},
        queries=[{"id": "q01", "category": "food", "query": "Question?"}],
        api_keys={"OpenAI": "openai-key", "Gemini": "google-key"},
        query_runner=fake_runner,
    )

    assert observed == {"OpenAI": "openai-key", "Gemini": "google-key"}


def test_each_model_processes_only_one_query_at_a_time():
    active_by_model = {"OpenAI": 0, "Gemini": 0}
    maximum_by_model = {"OpenAI": 0, "Gemini": 0}
    lock = threading.Lock()

    def fake_runner(*, query, api_key, model, model_label):
        with lock:
            active_by_model[model_label] += 1
            maximum_by_model[model_label] = max(
                maximum_by_model[model_label], active_by_model[model_label]
            )
        time.sleep(0.01)
        with lock:
            active_by_model[model_label] -= 1
        return {"query": query, "recommendations": []}

    run_parallel_benchmark(
        selected_models={"OpenAI": "gpt-test", "Gemini": "gemini-test"},
        queries=[
            {"id": f"q{index}", "category": "food", "query": f"Question {index}?"}
            for index in range(4)
        ],
        api_keys={"OpenAI": "openai-key", "Gemini": "google-key"},
        query_runner=fake_runner,
        max_workers=6,
    )

    assert maximum_by_model == {"OpenAI": 1, "Gemini": 1}
