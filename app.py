import json
import os
from pathlib import Path

import pandas as pd
import streamlit as st
from dotenv import load_dotenv

from services.benchmark import RANKING_MODELS, run_parallel_benchmark
from services.scoring import calculate_analytics, is_target_name
from services.storage import save_run


load_dotenv()

ROOT = Path(__file__).resolve().parent
QUERY_BANK_PATH = ROOT / "data" / "query_bank.json"
TARGET_NAME = "Cafe Athena"


def load_query_bank() -> list[dict]:
    return json.loads(QUERY_BANK_PATH.read_text(encoding="utf-8"))


def recommendation_rows(results: list[dict]) -> list[dict]:
    rows = []
    for item in results:
        if item["status"] != "success":
            continue
        for recommendation in item["result"].get("recommendations", []):
            rows.append(
                {
                    "Query": item["query"],
                    "Position": recommendation.get("position"),
                    "Restaurant": recommendation.get("restaurant"),
                    "Cafe Athena?": is_target_name(
                        recommendation.get("restaurant", "")
                    ),
                    "Model": item.get("model_label"),
                    "Category": item.get("category"),
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
    selected_model_labels = st.multiselect(
        "Ranking models",
        options=list(RANKING_MODELS),
        default=list(RANKING_MODELS),
        help="Every selected model runs the same query bank independently.",
    )
    st.info(
        "Web search is enabled for every query. A full five-model run makes "
        "100 model requests and may incur OpenRouter charges."
    )

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
    st.dataframe(
        pd.DataFrame(queries).rename(
            columns={"id": "ID", "category": "Category", "query": "Question"}
        ),
        use_container_width=True,
        hide_index=True,
    )

if "analysis" not in st.session_state:
    st.session_state.analysis = None

if st.button("Run visibility analysis", type="primary", use_container_width=True):
    if not api_key:
        st.error("Enter an OpenRouter API key in the sidebar.")
    elif not selected_model_labels:
        st.error("Select at least one ranking model.")
    else:
        selected_models = {
            label: RANKING_MODELS[label] for label in selected_model_labels
        }
        progress = st.progress(
            0,
            text=(
                f"Running {len(selected_models)} models in parallel across "
                f"{len(queries)} prompts..."
            ),
        )
        results = run_parallel_benchmark(
            selected_models=selected_models,
            queries=queries,
            api_key=api_key,
        )

        analytics = calculate_analytics(results)
        run_path = save_run(
            restaurant=restaurant,
            models=selected_models,
            results=results,
            scorecard=analytics,
        )
        st.session_state.analysis = {
            "results": results,
            "analytics": analytics,
            "run_path": str(run_path),
            "models": selected_models,
        }
        progress.progress(1.0, text="Analysis complete")

analysis = st.session_state.analysis
if analysis:
    scorecard = analysis["analytics"]["combined"]
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
    st.caption(
        f'Models: {", ".join(analysis["models"])}. '
        "Local run saved for future comparison."
    )
