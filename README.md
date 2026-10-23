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
app/
  layout.tsx              shell: THODI fonts + the rail, loaded once per request
  page.tsx                Overview pane — the report
  compare/[rival]/page.tsx  Head-to-head pane — you versus one named restaurant
  solutions/page.tsx      Act pane, waiting on the audit's actions[]
components/
  shell/Rail.tsx          navigation: report, rivals (with counts), solutions
  report/OverviewPane.tsx verdict, KPI row, matrix, tables, intent, reading notes
  report/ComparePane.tsx  where you win, where they win, by intent, why-not-yet
  report/MatrixTable.tsx  question x assistant grid — click a cell for the answer
  report/SideTables.tsx   who can see you / who is named instead
  primitives/             KPI card, KPI grid, definition tooltip
  ui/                     drawer, button
lib/view/
  ingest.ts               the one place that knows what the backend sends
  derive.ts               every number the report asserts
  compare.ts              head-to-head + the overlap that separates parallel from contested
  venue-match.ts          normalisation and alias matching, with a rival guard
  load-run.ts             reads the newest payload; the only filesystem call
data/runs/                one real run: 25 answers, 5 assistants, 5 questions
docs/report-payload.md    the contract, including the three load-bearing fields
scripts/probe-ingest.ts   adapter proof against different / thin / broken payloads
```

Navigation is three routes, not a scroll position: `/`, `/compare/<rival>`, `/solutions`.
Rivals in the rail are the restaurants actually named in the run, with their mention counts.

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
