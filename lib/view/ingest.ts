/**
 * Ingest — the only place that knows what the backend sends.
 *
 * The rule: never trust a key name, never trust a shape, never render raw JSON.
 * The backend is someone else's code and it will change; the report must not.
 * So this file hunts for keys by alias, coerces what it finds, derives whatever
 * is missing, and records every assumption it had to make in `issues`, which
 * the report shows under "how this was read". A display that silently guesses
 * is worse than one that says what it guessed.
 *
 * Three facts are load-bearing because the real answers required them:
 *
 *   via      ranked vs named-in-passing. Six of the first twenty-five answers
 *            named businesses without ranking them; calling that a position
 *            would have invented an order that was never there.
 *   refusal  an assistant that declines to name any business is not the same
 *            outcome as one that recommends a rival. Claude did this on three of
 *            five questions.
 *   error    a failed call must never become a zero. A zero reads as "you were
 *            not named", which is a claim about the venue rather than about us.
 */

import { matchesVenue, normalizeName } from './venue-match'

export type Basis = 'ranked' | 'mentioned'

export interface IngestedName {
  name: string
  position: number | null
  basis: Basis
  /** The model's stated reason, when the pipeline captured one. */
  reason?: string
  /** Pages the model cited for this recommendation. */
  sources?: string[]
}

export interface IngestedAnswer {
  questionId: string
  modelKey: string
  modelLabel: string
  grounded: boolean
  answer: string
  names: IngestedName[]
  mentioned: boolean
  position: number | null
  via: Basis | null
  refusal: boolean
  error: string | null
  latencyMs: number | null
}

export interface IngestedAssistant {
  key: string
  label: string
  grounded: boolean
  answered: number
  failed: number
  refused: number
  mentioned: number
  ranked: number
  passing: number
  mentionRate: number
  averagePosition: number | null
}

export interface IngestedQuestion {
  id: string
  text: string
  intent: string
}

export interface IngestedReport {
  runId: string
  startedAt: string | null
  venue: {
    name: string
    aliases: string[]
    neighbourhood: string
    city: string
    cuisine: string[]
    competitors: string[]
  }
  questions: IngestedQuestion[]
  answers: IngestedAnswer[]
  assistants: IngestedAssistant[]
  /** Rivals by mention count, target excluded. */
  competitors: Array<{ name: string; mentions: number; share: number }>
  totals: {
    questions: number
    assistants: number
    answers: number
    failed: number
    refused: number
    named: number
    ranked: number
  }
  /** Everything the ingestion had to assume, shown in the report. */
  issues: string[]
}

// ── key hunting ────────────────────────────────────────────────────────────

type Dict = Record<string, unknown>

const isDict = (v: unknown): v is Dict => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

function pick(source: Dict, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.\-]/g, '')
    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) return value.split(/[,;]/).map(s => s.trim()).filter(Boolean)
  return []
}

/** Assistant identity from a label, an object, or a bare key. */
/** A label that is really a slug ("perp", "gpt-5.5") reads as a typo on screen. */
function titleCase(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || /[A-Z]/.test(trimmed)) return trimmed
  return trimmed
    .split(/[\s-]+/)
    .map(word => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}

/**
 * Assistant identity from a label, an object, or a bare key.
 *
 * The key is always derived the same way — from the label — so the same
 * assistant arriving once as a string and once as an object does not become two
 * rows in the table. That bug showed up on the very first broken payload.
 */
function readModel(value: unknown, fallbackKey: string): { key: string; label: string; grounded: boolean } {
  const raw = isDict(value) ? asText(pick(value, ['label', 'name', 'title', 'model', 'id'])) : asText(value)
  const label = raw || titleCase(fallbackKey)
  const explicitKey = isDict(value) ? asText(pick(value, ['key', 'slug', 'modelKey'])) : ''
  const key = explicitKey || normalizeName(label).replace(/\s+/g, '-') || fallbackKey
  const grounded =
    (isDict(value) && value.grounded === true) || /perplexity|sonar|grounded|search/i.test(label)
  return { key, label: titleCase(label) === label ? label : titleCase(label), grounded }
}

const HEDGE =
  /\b(i can(?:'|no)t|cannot|can not|don't have|do not have|unable to|not able to|i'd rather not|rather not name|no reliable|can't verify|can't confirm)\b/i

// ── ingestion ──────────────────────────────────────────────────────────────

export function ingestRun(input: unknown): IngestedReport {
  const issues: string[] = []
  const root: Dict = isDict(input) && isDict((input as Dict).run) ? ((input as Dict).run as Dict) : isDict(input) ? (input as Dict) : {}

  if (!isDict(input)) issues.push('Payload was not an object; the report is rendering an empty shell.')

  // ── run identity ─────────────────────────────────────────────────────────
  const runId = asText(pick(root, ['runId', 'run_id', 'id', 'slug'])) || 'unnamed-run'
  const startedRaw = pick(root, ['startedAt', 'started_at', 'date', 'createdAt', 'timestamp', 'ranAt'])
  const startedAt = typeof startedRaw === 'string' && startedRaw.trim() ? startedRaw.trim() : null
  if (!startedAt) issues.push('No run timestamp found, so the report cannot be dated.')

  // ── venue ────────────────────────────────────────────────────────────────
  const venueRaw = pick(root, ['venue', 'restaurant', 'target', 'client'])
  const venueDict: Dict = isDict(venueRaw) ? venueRaw : {}
  const venueName = asText(isDict(venueRaw) ? pick(venueDict, ['name', 'title', 'restaurant']) : venueRaw) || 'Unnamed venue'
  const aliasesRaw = asList(pick(venueDict, ['aliases', 'alsoKnownAs', 'variants'])).map(asText).filter(Boolean)
  const venue = {
    name: venueName,
    aliases: aliasesRaw.length ? aliasesRaw : [venueName],
    neighbourhood: asText(pick(venueDict, ['neighbourhood', 'neighborhood', 'area', 'district'])),
    city: asText(pick(venueDict, ['city', 'town'])),
    cuisine: asList(pick(venueDict, ['cuisine', 'cuisines', 'type'])).map(asText).filter(Boolean),
    competitors: asList(pick(venueDict, ['competitors', 'rivals'])).map(asText).filter(Boolean),
  }
  if (!venue.name || venue.name === 'Unnamed venue') issues.push('Venue name missing from the payload.')

  // ── questions ────────────────────────────────────────────────────────────
  const questionsRaw = asList(pick(root, ['questions', 'questionBank', 'bank']))
  const questions: IngestedQuestion[] = questionsRaw.map((entry, index) => {
    if (typeof entry === 'string') return { id: `q${index + 1}`, text: entry, intent: '' }
    const row = isDict(entry) ? entry : {}
    return {
      id: asText(pick(row, ['id', 'qid', 'key'])) || `q${index + 1}`,
      text: asText(pick(row, ['text', 'question', 'q', 'prompt'])) || `Question ${index + 1}`,
      // Backend categories are snake_case keys ("greek_food"); the display never
      // showed raw keys anywhere else and should not start here.
      intent: asText(pick(row, ['intent', 'category', 'tag', 'type'])).replace(/_/g, ' ').toLowerCase(),
    }
  })
  if (!questions.length) issues.push('No question bank in the payload; questions are being inferred from the answers.')

  const questionById = new Map(questions.map(q => [q.id, q]))
  const questionByText = new Map(questions.map(q => [normalizeName(q.text), q]))
  const ensureQuestion = (id: string, text: string, intent = ''): IngestedQuestion => {
    const byText = questionByText.get(normalizeName(text))
    const existing = questionById.get(id) ?? byText
    if (existing) return existing
    const created: IngestedQuestion = { id, text: text || id, intent }
    questions.push(created)
    questionById.set(id, created)
    questionByText.set(normalizeName(created.text), created)
    return created
  }

  // ── answers: array, or a map keyed by question ───────────────────────────
  const answersRaw = pick(root, ['answers', 'results', 'responses', 'runs'])
  const flat: Dict[] = []

  if (Array.isArray(answersRaw)) {
    for (const entry of answersRaw) if (isDict(entry)) flat.push(entry)
  } else if (isDict(answersRaw)) {
    for (const [outerKey, bucket] of Object.entries(answersRaw)) {
      if (Array.isArray(bucket)) {
        for (const entry of bucket) if (isDict(entry)) flat.push({ questionId: outerKey, ...entry })
      } else if (isDict(bucket)) {
        for (const [innerKey, entry] of Object.entries(bucket)) {
          if (isDict(entry)) flat.push({ questionId: outerKey, model: innerKey, ...entry })
        }
      }
    }
  }
  if (!flat.length) issues.push('No answers found in the payload.')

  const answers: IngestedAnswer[] = flat.map((entry, index) => {
    // Question
    const questionText = asText(pick(entry, ['question', 'questionText', 'prompt']))
    const questionId =
      asText(pick(entry, ['questionId', 'question_id', 'qid', 'questionKey'])) ||
      (questionText ? ensureQuestion(`q-text-${index}`, questionText).id : `q${index + 1}`)
    const question = questionById.get(questionId) ?? ensureQuestion(questionId, questionText)

    // Assistant
    const model = readModel(
      pick(entry, ['model', 'assistant', 'platform', 'engine', 'modelKey', 'model_key', 'modelName']),
      `model-${index + 1}`
    )

    // Answer text
    const answerText = asText(pick(entry, ['answer', 'text', 'response', 'output', 'completion']))

    // Names, in whatever shape they arrive
    const namesRaw = asList(pick(entry, ['extracted', 'recommendations', 'mentions', 'names', 'ranked', 'businesses']))
    const names: IngestedName[] = namesRaw.flatMap((item, order) => {
      if (typeof item === 'string') {
        const name = item.trim()
        return name ? [{ name, position: order + 1, basis: 'ranked' as Basis }] : []
      }
      if (!isDict(item)) return []
      const name = asText(pick(item, ['name', 'business', 'title', 'restaurant']))
      if (!name) return []
      const basisRaw = asText(pick(item, ['basis', 'kind', 'type']))
      const basis: Basis = basisRaw === 'mentioned' || basisRaw === 'passing' ? 'mentioned' : 'ranked'
      const position = basis === 'ranked' ? asNumber(pick(item, ['position', 'rank', 'place'])) ?? order + 1 : null
      const reason = asText(pick(item, ['reason', 'why', 'note'])) || undefined
      const sources = asList(pick(item, ['sources', 'source_urls', 'urls']))
        .map(asText)
        .filter(Boolean)
        .slice(0, 4)
      return [{ name, position, basis, ...(reason ? { reason } : {}), ...(sources.length ? { sources } : {}) }]
    })

    // Error
    const errorRaw = pick(entry, ['error', 'failure', 'err'])
    const error = isDict(errorRaw)
      ? asText(pick(errorRaw, ['message', 'reason', 'code'])) || 'error'
      : asText(errorRaw) || null

    // Detection: trust it if present, derive it if not
    const detection = isDict(pick(entry, ['detection', 'verdict', 'result'])) ? (pick(entry, ['detection', 'verdict', 'result']) as Dict) : null
    const matchedName = names.find(n => matchesVenue(n.name, venue.aliases)) ?? null

    const refusalFlag =
      detection?.refusal === true || entry.refusal === true || entry.declined === true
    const refusal = refusalFlag || (!names.length && !error && HEDGE.test(answerText) && answerText.length > 0)

    const mentioned =
      detection?.mentioned === true ||
      (detection?.mentioned === undefined ? Boolean(matchedName) : false)

    const explicitPosition = detection ? asNumber(pick(detection, ['position', 'rank'])) : null
    const viaRaw = asText(pick(detection ?? {}, ['via', 'basis']))
    const via: Basis | null =
      viaRaw === 'ranked' || viaRaw === 'mentioned'
        ? (viaRaw as Basis)
        : matchedName
          ? matchedName.basis
          : null
    const position = mentioned ? explicitPosition ?? (via === 'ranked' ? matchedName?.position ?? null : null) : null

    return {
      questionId: question.id,
      modelKey: model.key,
      modelLabel: model.label,
      grounded: model.grounded,
      answer: answerText,
      names,
      mentioned,
      position,
      via,
      refusal,
      error,
      latencyMs: asNumber(pick(entry, ['latencyMs', 'latency', 'durationMs'])),
    }
  })

  // ── assistants, derived from the answers, never trusted as given ─────────
  const assistantOrder: string[] = []
  const byAssistant = new Map<string, IngestedAnswer[]>()
  for (const answer of answers) {
    if (!byAssistant.has(answer.modelKey)) {
      byAssistant.set(answer.modelKey, [])
      assistantOrder.push(answer.modelKey)
    }
    byAssistant.get(answer.modelKey)?.push(answer)
  }

  const assistants: IngestedAssistant[] = assistantOrder.map(key => {
    const rows = byAssistant.get(key) ?? []
    const ok = rows.filter(r => !r.error)
    const named = ok.filter(r => r.mentioned)
    const ranked = ok.filter(r => r.position !== null)
    const positions = ranked.map(r => r.position).filter((p): p is number => typeof p === 'number')
    return {
      key,
      label: rows[0]?.modelLabel ?? key,
      grounded: rows[0]?.grounded ?? false,
      answered: ok.length,
      failed: rows.length - ok.length,
      refused: ok.filter(r => r.refusal && !r.mentioned).length,
      mentioned: named.length,
      ranked: ranked.length,
      passing: named.length - ranked.length,
      mentionRate: ok.length ? named.length / ok.length : 0,
      averagePosition: positions.length ? positions.reduce((s, p) => s + p, 0) / positions.length : null,
    }
  })

  // The backend's own per-model block is used for display labels and as a
  // cross-check — never as the source of a rate.
  const providedRaw = pick(root, ['perModel', 'per_model', 'summary', 'assistants'])
  const provided: Dict | null = isDict(providedRaw)
    ? providedRaw
    : Array.isArray(providedRaw)
      ? Object.fromEntries(
          providedRaw
            .filter(isDict)
            .map(row => [asText(pick(row, ['modelKey', 'model_key', 'key', 'model', 'id'])), row])
            .filter(([key]) => Boolean(key))
        )
      : null
  if (provided) {
    for (const assistant of assistants) {
      const row = provided[assistant.key]
      if (isDict(row)) {
        const label = asText(pick(row, ['label', 'name', 'model']))
        if (label) {
          assistant.label = label
          // The answers carry their own copy of the label; sync it, or the
          // drawer will say "perplexity" while the table says "Perplexity".
          for (const answer of answers) if (answer.modelKey === assistant.key) answer.modelLabel = label
        }
        if (row.grounded === true) {
          assistant.grounded = true
          for (const answer of answers) if (answer.modelKey === assistant.key) answer.grounded = true
        }
      }
    }
    for (const assistant of assistants) {
      const row = provided[assistant.key]
      if (isDict(row)) {
        const theirRate = asNumber(pick(row, ['mentionRate', 'mention_rate']))
        if (theirRate !== null && Math.abs(theirRate - assistant.mentionRate) > 0.25) {
          issues.push(
            `${assistant.label}: backend reports a ${(theirRate * 100).toFixed(0)}% mention rate, the answers in this payload give ` +
              `${(assistant.mentionRate * 100).toFixed(0)}%. Showing the answers, not the summary.`
          )
        }
      }
    }
  }

  // ── competitors by mention count, target excluded ────────────────────────
  const counts = new Map<string, { name: string; mentions: number }>()
  for (const answer of answers) {
    const seen = new Set<string>()
    for (const entry of answer.names) {
      if (matchesVenue(entry.name, venue.aliases)) continue
      const key = normalizeName(entry.name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      const existing = counts.get(key)
      if (existing) existing.mentions += 1
      else counts.set(key, { name: entry.name, mentions: 1 })
    }
  }
  const answerCount = Math.max(1, answers.filter(a => !a.error).length)
  const competitors = Array.from(counts.values())
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name))
    .map(row => ({ ...row, share: row.mentions / answerCount }))

  const totals = {
    questions: questions.length,
    assistants: assistants.length,
    answers: answers.length,
    failed: answers.filter(a => a.error).length,
    refused: answers.filter(a => a.refusal && !a.error).length,
    named: answers.filter(a => a.mentioned).length,
    ranked: answers.filter(a => a.position !== null).length,
  }

  if (totals.failed)
    issues.push(
      totals.failed === 1
        ? '1 answer failed and is excluded from every rate.'
        : `${totals.failed} answers failed and are excluded from every rate.`
    )
  if (totals.refused) issues.push(`${totals.refused} answer${totals.refused === 1 ? '' : 's'} declined to name any business; counted as no mention, not as a rival win.`)

  return { runId, startedAt, venue, questions, answers, assistants, competitors, totals, issues }
}
