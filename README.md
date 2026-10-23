# Cafe Athena AI Visibility Agent

A small Streamlit application for the NYU SPS x Pulse Foundry hackathon. It runs a fixed bank of local restaurant queries through OpenAI, Gemini, and Claude with web search, measures Cafe Athena's visibility, and identifies the competitors that appear most often.

## What the MVP does

- Uses 20 curated Pacific Beach / San Diego prompts with primary and secondary categories.
- Runs OpenAI, Gemini, and Claude independently and in parallel.
- Searches the live web through each model provider's own API.
- Records restaurant recommendations and their positions.
- Calculates mention rate and average position by model and category.
- Shows cross-model consensus, competitor share of voice, and query-level evidence.
- Loads the saved 55-success three-model run as a static baseline on startup.
- Generates evidence-backed AISO recommendations by category using the competitors, reasons, and URLs in that baseline.
- Saves each successful run locally so the same test can be repeated later.

## Run locally

1. Install dependencies with `pip install -r requirements.txt`.
2. Copy `.env.example` to `.env` and add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GOOGLE_API_KEY`.
3. Start the application with `streamlit run app.py`.

The API key can also be entered temporarily in the application's sidebar. It is not saved by the application.

The `.env` file is ignored by Git and must never be committed. OpenRouter remains available as an optional fallback.

The dashboard does not need API keys to display the static baseline or its AISO recommendations. Keys are required only when starting a new live visibility run.

## Ranking models

The dashboard can run any selection of these fixed ranking models:

- OpenAI: `gpt-5.2`
- Gemini: `gemini-3.8-flash`
- Claude: `claude-sonnet-5`

A full direct-provider run makes 60 model requests: 20 prompts across three models. The three models can run alongside one another, but each model receives its 20 questions one by one to reduce rate-limit failures. The dashboard keeps their results separate while also calculating combined measurements.

## Test

Run `pytest`.

## Terminal-first benchmark

Run a quick two-prompt check and stream every response to the terminal:

```bash
python cli.py --limit 2
```

Run the complete benchmark and save a backend JSON export:

```bash
python cli.py
```

Use `--models Gemini Claude`, `--limit 5`, or `--workers 5` to control cost and concurrency. Completed responses print immediately, and the final JSON is written under `data/exports/` for a frontend team to consume.

## Important limitation

This application measures results returned by the selected model APIs with web search. It is a repeatable proxy for AI-search visibility, but it is not guaranteed to reproduce the consumer interfaces of Gemini, ChatGPT, or Claude exactly.
