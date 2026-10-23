# Cafe Athena AI Visibility Agent

A small Streamlit application for the NYU SPS x Pulse Foundry hackathon. It runs a fixed bank of local restaurant queries through multiple OpenRouter models with web search, measures Cafe Athena's visibility, and identifies the competitors that appear most often.

## What the MVP does

- Uses 19 curated Pacific Beach / San Diego prompts with primary and secondary categories.
- Runs OpenAI, Gemini, Claude, Grok, and DeepSeek independently and in parallel.
- Searches the live web through OpenRouter.
- Records restaurant recommendations and their positions.
- Calculates mention rate and average position by model and category.
- Shows cross-model consensus, competitor share of voice, and query-level evidence.
- Saves each successful run locally so the same test can be repeated later.

## Run locally

1. Install dependencies with `pip install -r requirements.txt`.
2. Copy `.env.example` to `.env` and add your OpenRouter API key.
3. Start the application with `streamlit run app.py`.

The API key can also be entered temporarily in the application's sidebar. It is not saved by the application.

## Ranking models

The dashboard can run any selection of these fixed ranking models:

- `openai/gpt-5.2`
- `google/gemini-3.8-flash`
- `anthropic/claude-sonnet-5`
- `x-ai/grok-latest`
- `deepseek/deepseek-flash`

A full run makes 95 model requests: 19 prompts across five models. Each selected model runs independently, and the dashboard keeps its results separate while also calculating combined measurements.

## Test

Run `pytest`.

## Important limitation

This application measures results returned by the selected OpenRouter model with web search. It is a repeatable proxy for AI-search visibility, but it is not guaranteed to reproduce the consumer interfaces of Gemini, ChatGPT, Claude, or Perplexity exactly.
