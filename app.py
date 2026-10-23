import json
import os
from pathlib import Path

import pandas as pd
import streamlit as st
from dotenv import load_dotenv

from services.benchmark import RANKING_MODELS, run_parallel_benchmark
from services.openrouter import OpenRouterError, validate_api_key
from services.scoring import calculate_analytics, is_target_name
from services.reporting import (
    category_scorecard_rows,
    filter_results,
    model_scorecard_rows,
    query_model_matrix,
)
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


queries = load_query_bank()

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
        "Web search is enabled for every query. With the current selection, "
        f"a full run makes {len(queries) * len(selected_model_labels)} model "
        "requests and may incur OpenRouter charges."
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
        try:
            validate_api_key(api_key)
        except OpenRouterError as error:
            st.error(str(error))
            st.info(
                "Paste the raw OpenRouter key beginning with `sk-or-v1-`. "
                "The app also accepts a value copied with the `Bearer` prefix."
            )
            st.stop()

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
    analytics = analysis["analytics"]
    scorecard = analytics["combined"]
    st.divider()
    overview_tab, models_tab, categories_tab, matrix_tab, evidence_tab = st.tabs(
        [
            "Overview",
            "Model comparison",
            "Category analysis",
            "Prompt matrix",
            "Evidence",
        ]
    )

    with overview_tab:
        st.subheader("Combined visibility scorecard")
        metric_1, metric_2, metric_3, metric_4 = st.columns(4)
        metric_1.metric("Successful responses", scorecard["successful_queries"])
        metric_2.metric("Cafe Athena mentions", scorecard["target_mentions"])
        metric_3.metric("Combined mention rate", f'{scorecard["mention_rate"]}%')
        metric_4.metric(
            "Average position",
            scorecard["average_position"]
            if scorecard["average_position"] is not None
            else "Not ranked",
        )

        if scorecard["successful_queries"] == 0:
            st.error(
                "No model responses succeeded. Open the Evidence tab to inspect "
                "the API errors before running the benchmark again."
            )
            common_errors = {}
            for item in analysis["results"]:
                if item.get("status") == "failed":
                    error = item.get("error", "Unknown error")
                    common_errors[error] = common_errors.get(error, 0) + 1
            with st.expander("Most common API errors", expanded=True):
                for error, count in sorted(
                    common_errors.items(), key=lambda pair: pair[1], reverse=True
                )[:5]:
                    st.code(f"{count} responses: {error}")

        competitors = scorecard["competitors"][:10]
        if competitors:
            st.subheader("Combined competitor share of voice")
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

    with models_tab:
        st.subheader("Independent model results")
        st.dataframe(
            pd.DataFrame(model_scorecard_rows(analytics)),
            use_container_width=True,
            hide_index=True,
        )
        selected_model = st.selectbox(
            "Show competitors reported by",
            options=list(analytics["by_model"]),
        )
        model_competitors = analytics["by_model"][selected_model]["competitors"][:10]
        if model_competitors:
            model_competitor_frame = pd.DataFrame(model_competitors)
            st.bar_chart(model_competitor_frame.set_index("name")["mention_rate"])
            st.dataframe(
                model_competitor_frame,
                use_container_width=True,
                hide_index=True,
            )

    with categories_tab:
        st.subheader("Visibility by customer intent")
        st.dataframe(
            pd.DataFrame(category_scorecard_rows(analytics)),
            use_container_width=True,
            hide_index=True,
        )
        selected_category = st.selectbox(
            "Inspect category competitors",
            options=list(analytics["by_category"]),
        )
        category_competitors = analytics["by_category"][selected_category][
            "competitors"
        ][:10]
        if category_competitors:
            category_frame = pd.DataFrame(category_competitors)
            st.bar_chart(category_frame.set_index("name")["mention_rate"])
            st.dataframe(category_frame, use_container_width=True, hide_index=True)

    with matrix_tab:
        st.subheader("Cafe Athena position for every prompt and model")
        st.dataframe(
            pd.DataFrame(query_model_matrix(analysis["results"])),
            use_container_width=True,
            hide_index=True,
        )
        st.subheader("Cross-model consensus")
        st.dataframe(
            pd.DataFrame(analytics["consensus"]),
            use_container_width=True,
            hide_index=True,
        )

    with evidence_tab:
        st.subheader("Query-level recommendations and sources")
        model_filter = st.selectbox(
            "Model",
            options=["All models", *analysis["models"]],
        )
        category_filter = st.selectbox(
            "Category",
            options=["All categories", *analytics["by_category"]],
        )
        filtered = filter_results(
            analysis["results"],
            model=model_filter,
            category=category_filter,
        )
        rows = recommendation_rows(filtered)
        if rows:
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
        else:
            st.warning("No usable recommendations were returned for this selection.")

        failures = [item for item in filtered if item["status"] == "failed"]
        if failures:
            with st.expander(f"Failed responses ({len(failures)})"):
                for failure in failures:
                    st.error(
                        f'{failure["model_label"]} / {failure["query_id"]}: '
                        f'{failure["error"]}'
                    )

        st.download_button(
            "Download this run as JSON",
            data=json.dumps(analysis, indent=2, ensure_ascii=False),
            file_name="cafe-athena-multi-model-visibility-run.json",
            mime="application/json",
        )

    st.caption(
        f'Models: {", ".join(analysis["models"])}. '
        "Every model ran independently against the same prompt bank."
    )
