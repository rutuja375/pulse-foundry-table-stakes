from services.openrouter import normalize_api_key


def test_normalize_api_key_accepts_raw_key():
    assert normalize_api_key("  sk-or-v1-example  ") == "sk-or-v1-example"


def test_normalize_api_key_removes_bearer_prefix():
    assert normalize_api_key("Bearer sk-or-v1-example") == "sk-or-v1-example"
    assert normalize_api_key("bearer   sk-or-v1-example ") == "sk-or-v1-example"
