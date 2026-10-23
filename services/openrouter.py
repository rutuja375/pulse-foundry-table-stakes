import json
import re
from typing import Any

import requests


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterError(RuntimeError):
    """Raised when OpenRouter does not return a usable response."""


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise OpenRouterError("The model response did not contain valid JSON.")
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as error:
            raise OpenRouterError("The model returned malformed JSON.") from error


def run_restaurant_query(
    *,
    query: str,
    api_key: str,
    model: str,
    timeout: int = 120,
) -> dict[str, Any]:
    prompt = f"""
You are measuring restaurant visibility in AI search. You must search the current
web before answering the customer question below.

Customer question: {query}
Search location: Pacific Beach, San Diego, California.

Act like a neutral restaurant recommendation assistant. Do not automatically
include Cafe Athena. Recommend at most five restaurants and rank them in the
order you would show a customer. Use only current public evidence and do not
invent facts, restaurants, or URLs.

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

    response = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/rutuja375/pulse-foundry-table-stakes",
            "X-Title": "Cafe Athena AI Visibility Agent",
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "tools": [{"type": "openrouter:web_search"}],
            "temperature": 0,
        },
        timeout=timeout,
    )

    if not response.ok:
        try:
            detail = response.json()
        except ValueError:
            detail = response.text
        raise OpenRouterError(f"OpenRouter returned {response.status_code}: {detail}")

    payload = response.json()
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise OpenRouterError("OpenRouter returned an unexpected response.") from error

    parsed = _extract_json(content)
    recommendations = parsed.get("recommendations")
    if not isinstance(recommendations, list):
        raise OpenRouterError("The model response is missing a recommendations list.")

    for index, recommendation in enumerate(recommendations, start=1):
        recommendation.setdefault("position", index)
        recommendation.setdefault("reason", "")
        recommendation.setdefault("source_urls", [])

    parsed["query"] = query
    parsed["raw_response"] = content
    parsed["model"] = model
    return parsed
