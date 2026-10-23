# Cafe Athena AI Visibility Agent

A small Streamlit application for the NYU SPS x Pulse Foundry hackathon. It runs a fixed bank of local restaurant queries through an OpenRouter model with web search, measures Cafe Athena's visibility, and identifies the competitors that appear most often.

## What the MVP does

- Uses a fixed Pacific Beach / San Diego query bank.
- Searches the live web through OpenRouter.
- Records restaurant recommendations and their positions.
- Calculates mention rate and average position for Cafe Athena.
- Shows competitor share of voice and query-level evidence.
- Saves each successful run locally so the same test can be repeated later.

## Run locally

1. Install dependencies with `pip install -r requirements.txt`.
2. Copy `.env.example` to `.env` and add your OpenRouter API key.
3. Start the application with `streamlit run app.py`.

The API key can also be entered temporarily in the application's sidebar. It is not saved by the application.

## Default model

The default search model is `google/gemini-3.8-flash`. The model ID is editable in the sidebar, so another OpenRouter model can be tested without changing the code.

## Test

Run `pytest`.

## Important limitation

This application measures results returned by the selected OpenRouter model with web search. It is a repeatable proxy for AI-search visibility, but it is not guaranteed to reproduce the consumer interfaces of Gemini, ChatGPT, Claude, or Perplexity exactly.
