import json
import re
from typing import Any

import requests


NATIVE_MODELS = {
    "OpenAI": "gpt-5.2",
    "Gemini": "gemini-3.8-flash",
    "Claude": "claude-sonnet-5",
}

MODEL_KEY_ENV = {
    "OpenAI": "OPENAI_API_KEY",
    "Gemini": "GOOGLE_API_KEY",
    "Claude": "ANTHROPIC_API_KEY",
}


class ProviderError(RuntimeError):
    """Raised when a native model provider returns no usable answer."""


def build_prompt(query: str) -> str:
    return f"""
You are measuring restaurant visibility in AI search. Search the current web
before answering the customer question below.

Customer question: {query}
Search location: Pacific Beach, San Diego, California.

Act like a neutral restaurant recommendation assistant. Do not automatically
include Cafe Athena. Recommend at most five restaurants, ranked in the order
you would show a customer. Use current public evidence and do not invent facts,
restaurants, or URLs.

Return only a JSON object with this exact shape:
{{
  "query": "the customer question",
  "recommendations": [
    {{
      "restaurant": "restaurant name",
      "position": 1,
      "reason": "short evidence-based reason",
      "source_urls": ["https://source.example"]
    }}
  ]
}}
""".strip()


def extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start < 0 or end <= start:
            raise ProviderError("The model response did not contain valid JSON.")
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as error:
            raise ProviderError("The model returned malformed JSON.") from error


def normalize_result(text: str, query: str, model: str) -> dict[str, Any]:
    parsed = extract_json(text)
    recommendations = parsed.get("recommendations")
    if not isinstance(recommendations, list):
        raise ProviderError("The model response is missing a recommendations list.")
    for index, recommendation in enumerate(recommendations, start=1):
        recommendation.setdefault("position", index)
        recommendation.setdefault("reason", "")
        recommendation.setdefault("source_urls", [])
    parsed.update(query=query, raw_response=text, model=model)
    return parsed


def _error_detail(response) -> Any:
    try:
        return response.json()
    except ValueError:
        return response.text


def run_openai(query: str, api_key: str, model: str, timeout: int) -> dict:
    response = requests.post(
        "https://api.openai.com/v1/responses",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "input": build_prompt(query),
            "tools": [{"type": "web_search"}],
            "tool_choice": "required",
        },
        timeout=timeout,
    )
    if not response.ok:
        raise ProviderError(f"OpenAI returned {response.status_code}: {_error_detail(response)}")
    payload = response.json()
    text = payload.get("output_text", "")
    if not text:
        text = "".join(
            part.get("text", "")
            for item in payload.get("output", [])
            if item.get("type") == "message"
            for part in item.get("content", [])
            if part.get("type") == "output_text"
        )
    if not text:
        raise ProviderError("OpenAI returned an unexpected response.")
    return normalize_result(text, query, model)


def run_gemini(query: str, api_key: str, model: str, timeout: int) -> dict:
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json={
            "contents": [{"role": "user", "parts": [{"text": build_prompt(query)}]}],
            "tools": [{"google_search": {}}],
        },
        timeout=timeout,
    )
    if not response.ok:
        raise ProviderError(f"Gemini returned {response.status_code}: {_error_detail(response)}")
    try:
        parts = response.json()["candidates"][0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in parts)
    except (KeyError, IndexError, TypeError) as error:
        raise ProviderError("Gemini returned an unexpected response.") from error
    return normalize_result(text, query, model)


def run_claude(query: str, api_key: str, model: str, timeout: int) -> dict:
    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": 2048,
            "messages": [{"role": "user", "content": build_prompt(query)}],
            "tools": [{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}],
        },
        timeout=timeout,
    )
    if not response.ok:
        raise ProviderError(f"Claude returned {response.status_code}: {_error_detail(response)}")
    text = "".join(
        block.get("text", "")
        for block in response.json().get("content", [])
        if block.get("type") == "text"
    )
    if not text:
        raise ProviderError("Claude returned an unexpected response.")
    return normalize_result(text, query, model)


def run_native_query(*, query: str, api_key: str, model: str, model_label: str, timeout: int = 120) -> dict:
    if not api_key.strip():
        raise ProviderError(f"Enter an API key for {model_label}.")
    runners = {"OpenAI": run_openai, "Gemini": run_gemini, "Claude": run_claude}
    try:
        runner = runners[model_label]
    except KeyError as error:
        raise ProviderError(f"Unsupported native provider: {model_label}") from error
    return runner(query, api_key.strip(), model, timeout)
