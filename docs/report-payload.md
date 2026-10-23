# Payload contract — what the report display consumes

The display renders whatever it is given. It does not import the audit engine, and it does not
require any particular key name or nesting. This document describes the shape it reads best, so the
backend can target it instead of guessing.

Everything below is optional except `answers`. Missing data degrades; it never crashes.

```json
{
  "runId": "cafe-athena_2026-10-23T15-15-50",
  "startedAt": "2026-10-23T15:15:50.000Z",
  "bankId": "cafe-athena-v1",

  "venue": {
    "name": "Café Athena",
    "aliases": ["Café Athena", "Cafe Athena", "Athena PB"],
    "neighbourhood": "Pacific Beach",
    "city": "San Diego",
    "cuisine": ["Greek", "Mediterranean"],
    "competitors": ["Costa Brava"]
  },

  "questions": [
    { "id": "p1", "text": "What are the best Greek restaurants in Pacific Beach?", "intent": "cuisine" }
  ],

  "answers": [
    {
      "questionId": "p1",
      "modelKey": "perplexity",
      "answer": "verbatim reply, markdown and citations included",
      "extracted": [
        { "name": "Cafe Athena", "position": 1, "basis": "ranked" }
      ],
      "detection": { "mentioned": true, "position": 1, "via": "ranked", "refusal": false },
      "latencyMs": 4200,
      "error": null
    }
  ],

  "perModel": [
    { "modelKey": "perplexity", "label": "Perplexity (Sonar)", "grounded": true,
      "mentionRate": 0.6, "averagePosition": 3.3, "answered": 5, "failed": 0 }
  ]
}
```

## The three fields that are not optional in spirit

**`basis` / `via` — `"ranked"` vs `"mentioned"`.** Six of the first twenty-five real answers named
businesses without ranking them ("good for breakfast, but for Greek food…"). If those are recorded as
a position, the report invents an order that the answer never gave. `mentioned` counts as a mention
and carries no position.

**`refusal`.** An assistant that declines to name any business is not the same outcome as one that
recommends a rival. Claude did this on three of five questions: *"I can't verify current menus … so
I'd rather not name places that might be wrong."* The display shows that as its own cell state.

**`error`.** A failed call must stay a failure. Rendering it as a zero reads as "you were not named",
which is a claim about the restaurant rather than about the request. Failed answers are excluded from
every rate, and the denominator is completed answers, never questions.

## Shapes that are already accepted

Verified in `scripts/probe-ingest.ts`, no code change needed:

- `answers` as an array **or** as a map keyed by question id
- `model` as an object `{key,label,grounded}` **or** a bare string `"Gemini"`
- names as objects with `position`/`basis` **or** plain strings in rank order
- `position` as a number **or** a string like `"#2"`
- dates as ISO **or** human (`"Oct 23, 2026"`)
- no `questions` block at all — questions are inferred from the answers
- no `perModel` block — summaries are derived from the answers

Anything that had to be assumed is printed at the bottom of the report under **How this was read**.
If the payload contradicts itself (for example a `perModel` mention rate that disagrees with the
answers), the answers win and the conflict is logged rather than silently averaged.

## Comparison layer — what the display needs beyond the base payload

Clicking a rival opens a head-to-head. Most of it is computed from `answers` alone, so nothing below is
required for the comparison to work. The two blocks that need the audit's input are the **why** and the
**red herrings**, and the display will not invent either.

### Where each side is stronger — computed, no field needed

Per question: best position you received, best position they received, and a verdict
(`ahead` / `behind` / `only-you` / `only-them` / `neither`). Plus an overlap figure — the share of
questions naming both — which is what separates *parallel visibility* (each of you named on different
questions, so equal mention counts are not a dead heat) from *contested*.

### Why — needs `evidence`

```json
"evidence": [
  { "factor": "Review count", "target": "412",
    "rivals": [{ "name": "Costa Brava", "value": "1,240" }],
    "impact": "explains" }
]
```

`impact` is the field that makes the third block possible:

| value       | meaning                                                              |
|-------------|----------------------------------------------------------------------|
| `explains`  | this difference plausibly accounts for the visibility gap            |
| `context`   | a real difference that does not explain the gap                      |
| `unknown`   | measured, causality unproven — shown, but not sold as a reason       |

`context` is what an owner needs most and gets least: the differences that *look* alarming and change
nothing. Without the flag, the display has to guess which is which, and guessing is how a report starts
telling a restaurant to fix things that were never broken.

### Solutions — needs `actions` with targets

```json
"actions": [
  { "title": "Add vegan, vegetarian and gluten-free labels to the menu page",
    "detail": "…", "priority": "high",
    "evidence": "0 of 5 dietary questions named the venue",
    "fixes": { "intents": ["dietary"], "rivals": ["Costa Brava"] } }
]
```

`fixes` lets the comparison hand its filter to the solutions layer: click Costa Brava, then
"show me how to win these three questions", and the action list arrives already scoped. Without it the
button can only scroll to a generic list, which is a much weaker promise.

## Local check

```bash
npx tsx scripts/probe-ingest.ts     # three payload shapes: different, thin, and broken
npm run dev                          # renders the newest payload in data/runs/
```

A single answer can be linked directly: `/?answer=p1:perplexity`.
