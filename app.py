import json
import os
from pathlib import Path

import pandas as pd
import streamlit as st
from dotenv import load_dotenv

from services.openrouter import OpenRouterError, run_restaurant_query
from services.scoring import calculate_visibility, normalize_name
from services.storage import save_run


load_dotenv()

ROOT = Path(__file__).resolve().parent
QUERY_BANK_PATH = ROOT / "data" / "query_bank.json"
DEFAULT_MODEL = os.getenv("OPENROUTER_SEARCH_MODEL", "google/gemini-3.8-flash")
TARGET_NAME = "Cafe Athena"


def load_query_bank() -> list[str]:
    return json.loads(QUERY_BANK_PATH.read_text(encoding="utf-8"))


def recommendation_rows(results: list[dict]) -> list[dict]:
    rows = []
    target = normalize_name(TARGET_NAME)
    for item in results:
        if item["status"] != "success":
            continue
        for recommendation in item["result"].get("recommendations", []):
            rows.append(
                {
                    "Query": item["query"],
                    "Position": recommendation.get("position"),
                    "Restaurant": recommendation.get("restaurant"),
                    "Cafe Athena?": normalize_name(
                        recommendation.get("restaurant", "")
                    ) == target,
                    "Reason": recommendation.get("reason", ""),
                    "Sources": "\n".join(recommendation.get("source_urls", [])),
                }
            )
    return rows


st.set_page_config(
    page_title="Cafe Athena AI Visibility",
    page_icon="🔎",
    layout="wide",
)
st.title("Cafe Athena AI Visibility Agent")
st.caption("Measure how often Cafe Athena appears in AI-powered restaurant searches.")

with st.sidebar:
    st.header("Configuration")
    api_key = st.text_input(
        "OpenRouter API key",
        value=os.getenv("OPENROUTER_API_KEY", ""),
        type="password",
        help="Used only for this session and never saved by the application.",
    )
    model = st.text_input("OpenRouter model", value=DEFAULT_MODEL)
    st.info("Web search is enabled for every query. API and search usage may incur charges.")

st.subheader("Target restaurant")
restaurant = {
    "name": TARGET_NAME,
    "website": "https://cafeathena.com",
    "address": "1846 Garnet Ave, San Diego, CA 92109",
    "cuisine": ["Greek", "Mediterranean"],
}

left, middle, right = st.columns(3)
left.text_input("Restaurant", value=restaurant["name"], disabled=True)
middle.text_input("Website", value=restaurant["website"], disabled=True)
right.text_input("Location", value=restaurant["address"], disabled=True)

queries = load_query_bank()
with st.expander(f"Fixed query bank ({len(queries)} questions)"):
    for number, query in enumerate(queries, start=1):
        st.write(f"{number}. {query}")

if "analysis" not in st.session_state:
    st.session_state.analysis = None

if st.button("Run visibility analysis", type="primary", use_container_width=True):
    if not api_key:
        st.error("Enter an OpenRouter API key in the sidebar.")
    elif not model.strip():
        st.error("Enter an OpenRouter model ID.")
    else:
        results = []
        progress = st.progress(0, text="Starting analysis...")

        for index, query in enumerate(queries, start=1):
            progress.progress(
                (index - 1) / len(queries),
                text=f"Searching {index} of {len(queries)}: {query}",
            )
            try:
                result = run_restaurant_query(
                    query=query,
                    api_key=api_key,
                    model=model.strip(),
                )
                results.append({"query": query, "status": "success", "result": result})
            except Exception as error:
                results.append({"query": query, "status": "failed", "error": str(error)})

        scorecard = calculate_visibility(results)
        run_path = save_run(
            restaurant=restaurant,
            model=model.strip(),
            results=results,
            scorecard=scorecard,
        )
        st.session_state.analysis = {
            "results": results,
            "scorecard": scorecard,
            "run_path": str(run_path),
            "model": model.strip(),
        }
        progress.progress(1.0, text="Analysis complete")

analysis = st.session_state.analysis
if analysis:
    scorecard = analysis["scorecard"]
    st.divider()
    st.subheader("Visibility scorecard")

    metric_1, metric_2, metric_3, metric_4 = st.columns(4)
    metric_1.metric("Successful queries", scorecard["successful_queries"])
    metric_2.metric("Cafe Athena mentions", scorecard["target_mentions"])
    metric_3.metric("Mention rate", f'{scorecard["mention_rate"]}%')
    metric_4.metric(
        "Average position",
        scorecard["average_position"]
        if scorecard["average_position"] is not None
        else "Not ranked",
    )

    competitors = scorecard["competitors"][:10]
    if competitors:
        st.subheader("Competitor share of voice")
        competitor_frame = pd.DataFrame(competitors)
        st.bar_chart(competitor_frame.set_index("name")["mention_rate"])
        st.dataframe(
            competitor_frame.rename(
                columns={
                    "name": "Competitor",
                    "mentions": "Mentions",
                    "mention_rate": "Mention rate (%)",
                }
            ),
            use_container_width=True,
            hide_index=True,
        )

    st.subheader("Query-level evidence")
    rows = recommendation_rows(analysis["results"])
    if rows:
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
    else:
        st.warning("No usable recommendations were returned.")

    failures = [item for item in analysis["results"] if item["status"] == "failed"]
    if failures:
        with st.expander(f"Failed queries ({len(failures)})"):
            for failure in failures:
                st.error(f'{failure["query"]}: {failure["error"]}')

    st.download_button(
        "Download this run as JSON",
        data=json.dumps(analysis, indent=2, ensure_ascii=False),
        file_name="cafe-athena-visibility-run.json",
        mime="application/json",
    )
    st.caption(f'Model: {analysis["model"]}. Local run saved for future comparison.')
