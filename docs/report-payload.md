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

## Local check

```bash
npx tsx scripts/probe-ingest.ts     # three payload shapes: different, thin, and broken
npm run dev                          # renders the newest payload in data/runs/
```

A single answer can be linked directly: `/?answer=p1:perplexity`.
