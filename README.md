# pulse-foundry-table-stakes

AI visibility audit for restaurants: ask real customer questions of several AI assistants, then show
what came back. This repository holds the **display** — the part that takes whatever the audit
produces and turns it into something a restaurant owner can read, argue with, and act on.

The audit engine (question bank, model calls, extraction, storage) lives elsewhere. This app renders
its output and nothing else: it does not import the engine, hold API keys, or call a model.

```bash
npm install
npm run dev            # http://localhost:3000 — renders the newest payload in data/runs/
npm run probe:ingest   # proves the ingestion against three payload shapes: different, thin, broken
```

## What is here

```
app/                     shell, design tokens, the single report route
components/report/       the report itself
  ReportView.tsx           verdict, KPI row, sections, evidence drawer
  MatrixTable.tsx          question x assistant grid — the centre of the page
  SideTables.tsx           who can see you / who is named instead
components/primitives/   KPI card, KPI grid, tooltip
components/ui/           drill-down drawer
lib/view/                ingest → derive, and nothing else
  ingest.ts                the one place that knows what the backend sends
  derive.ts                every number the page asserts
  venue-match.ts           normalisation and alias matching, with a rival guard
data/runs/               payloads to render. Real answers, from a real run.
docs/report-payload.md   the contract: what the display reads, and why three fields matter
scripts/probe-ingest.ts  the adapter proof
```

## Three rules the code enforces

1. **No component does arithmetic.** Every figure comes from `lib/view/derive.ts`, so the same number
   cannot disagree with itself across two sections.
2. **No component reads raw payload.** `ingest.ts` hunts keys by alias, coerces what it finds, derives
   what is missing, and prints its assumptions at the bottom of the report under *How this was read*.
3. **Absence is not zero.** A failed call, an assistant that refuses to name any business, and an
   answer that recommends rivals are three different states, shown differently. Collapsing them would
   turn a bug into a finding.

## Design language

Adopted from THODI's **Serene Ember**, not re-derived: 8px control radius, 24px cards, Spectral for
headlines and figures, Hanken Grotesk for UI, JetBrains Mono for data columns, terracotta `#a4370f` as
the only structural accent, teal `#4F625B` as the data counterpoint. Tokens are copied from
`companies/fuego-azteca/web/tokens.css` — the values are THODI's, and the few extra names in
`app/globals.css` are marked as adapters so nobody mistakes them for a new palette.

Why adopt rather than invent: the reader has used a thousand apps and none of ours. Anything we
invent, they have to learn.

## Interaction conventions

The reader is assumed to have time and no tolerance for puzzles. So:

- **Buttons look pressable at rest** — 1px border, filled primary, 8px radius, 40px height. Nothing
  depends on hover to be understood.
- **Definitions sit on marked triggers** — a dotted underline or a circled `?` says a definition
  exists. Hover opens it, and so do keyboard focus and a tap; Escape and click-away close it.
- **Clickable cells are underlined at rest**, so the matrix reads as interactive before anyone hovers.
- **Position is visible** — the sticky nav marks the current section with a solid terracotta rule.
- **Every clickable state has a URL** — `?answer=p1:perplexity` links straight to one answer.
- **The primary action is always on screen** — Print / save PDF, in the nav, because the report is
  meant to be handed over.

## Status

The report renders a run of 25 real answers across five assistants (ChatGPT, Claude, Gemini,
Perplexity, DeepSeek) on five questions for Café Athena, Pacific Beach. Print styles are wired, so
Cmd-P produces the hand-over PDF. A single answer can be linked directly: `/?answer=p1:perplexity`.
