/**
 * Backend adapter — their run shape, our display contract.
 *
 * The backend (`services/storage.py` on main) writes:
 *
 *   { run_id, created_at, restaurant, models, results[], scorecard }
 *
 * where each result is one (query, model) pair holding a JSON blob of ranked
 * recommendations. This module maps that onto the contract the display already
 * speaks, so `ingest.ts` stays the only thing that knows about payloads and the
 * panes stay untouched.
 *
 * Three things the backend knows that we were discarding, and now keep:
 *
 *   reason        why the model picked a restaurant — the closest thing to a
 *                 receipt that exists anywhere in the pipeline
 *   source_urls   the pages the model cited, per recommendation
 *   raw_response  the model's actual output, JSON and all
 *
 * Refusals are inferred, not asserted: their prompt demands a JSON list, so an
 * empty list plus hedging language is the closest signal available. It is
 * recorded as `refusal` only when the words are there.
 */

interface BackendRecommendation {
  restaurant?: string
  position?: number | string
  reason?: string
  source_urls?: string[]
}

interface BackendResult {
  model_label?: string
  model_id?: string
  query_id?: string
  category?: string
  secondary_categories?: string[]
  query?: string
  status?: string
  result?: {
    recommendations?: BackendRecommendation[]
    raw_response?: string
    model?: string
  }
  error?: string
}

interface BackendScorecard {
  successful_queries?: number
  target_mentions?: number
  mention_rate?: number
  average_position?: number | null
}

export interface BackendRun {
  run_id?: string
  created_at?: string
  restaurant?: { name?: string; website?: string; address?: string; cuisine?: string[] }
  models?: Record<string, string>
  results?: BackendResult[]
  scorecard?: {
    combined?: BackendScorecard
    by_model?: Record<string, BackendScorecard>
    by_category?: Record<string, BackendScorecard>
    consensus?: unknown[]
  }
}

/** Their runs are recognisable by the pair of keys nothing else uses. */
export function isBackendRun(payload: unknown): payload is BackendRun {
  if (!payload || typeof payload !== 'object') return false
  const candidate = payload as BackendRun
  return Array.isArray(candidate.results) && Boolean(candidate.scorecard)
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** "1846 Garnet Ave, San Diego, CA 92109" → "San Diego" */
function cityFromAddress(address: string): string {
  const parts = address.split(',').map(part => part.trim())
  if (parts.length >= 2) return parts[1].replace(/\s+CA\s*\d*$/i, '').trim()
  return ''
}

const HEDGE = /\b(can(?:not|'t)|unable|not able|no reliable|don't have|do not have|i'd rather|wouldn't want)\b/i

export interface AdaptedRun {
  /** Contract-shaped payload, ready for ingestRun(). */
  payload: Record<string, unknown>
  /** Their own numbers, for the cross-check in "How this was read". */
  reported: Record<string, unknown> | null
}

export function adaptBackendRun(run: BackendRun): AdaptedRun {
  const results = Array.isArray(run.results) ? run.results : []
  const restaurant = run.restaurant ?? {}
  const name = (restaurant.name ?? '').trim() || 'Unnamed venue'
  const city = restaurant.address ? cityFromAddress(restaurant.address) : ''

  // Their target is fixed; we still derive aliases so accent variants match.
  const aliases = Array.from(
    new Set(
      [name, `${name} San Diego`, `${name} Restaurant`, `${name} Restaurant and Bar`].filter(Boolean)
    )
  )

  const questions: Array<{ id: string; text: string; intent: string }> = []
  const answers: Array<Record<string, unknown>> = []

  for (const item of results) {
    const questionId = item.query_id ?? slug(item.query ?? 'question')
    if (!questions.some(question => question.id === questionId)) {
      questions.push({
        id: questionId,
        text: item.query ?? questionId,
        intent: item.category ?? '',
      })
    }

    const modelLabel = item.model_label ?? item.model_id ?? 'unknown'
    const modelKey = slug(modelLabel)
    const succeeded = item.status === 'success'
    const recommendations = item.result?.recommendations ?? []
    const raw = item.result?.raw_response ?? ''

    const extracted = succeeded
      ? recommendations.flatMap((recommendation, index) => {
          const restaurantName = String(recommendation.restaurant ?? '').trim()
          if (!restaurantName) return []
          const position =
            typeof recommendation.position === 'number'
              ? recommendation.position
              : Number.parseInt(String(recommendation.position ?? ''), 10) || index + 1
          return [
            {
              name: restaurantName,
              position,
              basis: 'ranked' as const,
              reason: typeof recommendation.reason === 'string' ? recommendation.reason : undefined,
              sources: Array.isArray(recommendation.source_urls)
                ? recommendation.source_urls.filter(url => typeof url === 'string').slice(0, 4)
                : undefined,
            },
          ]
        })
      : []

    answers.push({
      questionId,
      modelKey,
      modelLabel,
      grounded: true, // they run every query with web search enabled
      answer: raw,
      extracted,
      // An empty list is the only refusal signal their pipeline can produce.
      refusal: succeeded && extracted.length === 0 && HEDGE.test(raw),
      error: succeeded ? null : (item.error ?? 'failed'),
      latencyMs: null,
    })
  }

  const byModel = run.scorecard?.by_model ?? {}
  const perModel = Object.entries(byModel).map(([label, scorecard]) => {
    const rows = results.filter(item => (item.model_label ?? '') === label)
    return {
      modelKey: slug(label),
      label,
      grounded: true,
      // Their rate is a percentage; ours is a fraction. Converted here so the
      // cross-check in ingest compares like with like instead of flagging noise.
      mentionRate:
        typeof scorecard.mention_rate === 'number' ? scorecard.mention_rate / 100 : undefined,
      averagePosition: scorecard.average_position,
      answered: scorecard.successful_queries,
      failed: rows.filter(item => item.status !== 'success').length,
    }
  })

  const payload = {
    runId: run.run_id ?? 'backend-run',
    startedAt: run.created_at ?? null,
    bankId: 'cafe-athena-query-bank-v1',
    venue: {
      name,
      aliases,
      neighbourhood: '',
      city,
      cuisine: Array.isArray(restaurant.cuisine) ? restaurant.cuisine : [],
      competitors: [],
      website: restaurant.website,
      address: restaurant.address,
    },
    questions,
    answers,
    perModel,
    source: 'backend',
  }

  return {
    payload,
    reported: run.scorecard?.combined
      ? {
          mentionRate:
            typeof run.scorecard.combined.mention_rate === 'number'
              ? run.scorecard.combined.mention_rate / 100
              : undefined,
          mentions: run.scorecard.combined.target_mentions,
          answered: run.scorecard.combined.successful_queries,
          averagePosition: run.scorecard.combined.average_position,
        }
      : null,
  }
}
