/**
 * Derivations — everything the report asserts, computed in one place.
 *
 * No component does arithmetic. If a number appears on screen it came from a
 * function in this file, which means it can be tested, and it means the same
 * number cannot disagree with itself across two sections.
 */

import type { IngestedAnswer, IngestedReport } from './ingest'

export type CellKind = 'ranked' | 'passing' | 'refused' | 'absent' | 'error' | 'missing'

export interface Cell {
  kind: CellKind
  position: number | null
  answer: IngestedAnswer | null
}

export function cellFor(answer: IngestedAnswer | undefined): Cell {
  if (!answer) return { kind: 'missing', position: null, answer: null }
  if (answer.error) return { kind: 'error', position: null, answer }
  if (answer.mentioned) {
    return answer.position !== null
      ? { kind: 'ranked', position: answer.position, answer }
      : { kind: 'passing', position: null, answer }
  }
  if (answer.refusal) return { kind: 'refused', position: null, answer }
  return { kind: 'absent', position: null, answer }
}

export function buildMatrix(report: IngestedReport): {
  rows: Array<{ questionId: string; text: string; intent: string; cells: Cell[] }>
  assistants: IngestedReport['assistants']
} {
  const index = new Map<string, IngestedAnswer>()
  for (const answer of report.answers) index.set(`${answer.questionId}:${answer.modelKey}`, answer)

  const rows = report.questions.map(question => ({
    questionId: question.id,
    text: question.text,
    intent: question.intent,
    cells: report.assistants.map(assistant => cellFor(index.get(`${question.id}:${assistant.key}`))),
  }))

  return { rows, assistants: report.assistants }
}

/** Percentage with no decimals under 10%, one above. Never 0% when it is nonzero. */
export function formatRate(rate: number | null): string {
  if (rate === null || Number.isNaN(rate)) return '—'
  const pct = rate * 100
  if (pct === 0) return '0%'
  if (pct < 10) return `${pct.toFixed(1)}%`
  return `${Math.round(pct)}%`
}

export function formatPosition(value: number | null): string {
  return value === null ? '—' : value.toFixed(1)
}

export function formatDate(iso: string | null): string {
  if (!iso) return 'Undated'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/**
 * The one sentence the whole report exists to support.
 *
 * Written as "invisible to N of M" rather than "visible to N", because a
 * restaurant owner acts on absence and a percentage of mention reads as a
 * score. Failing answers are excluded from the denominator, never counted as
 * silence — that distinction is the difference between a finding and a bug.
 */
export function headline(report: IngestedReport): {
  invisible: IngestedReport['assistants']
  total: number
  sentence: string
} {
  const counted = report.assistants.filter(a => a.answered > 0)
  const invisible = counted.filter(a => a.mentioned === 0)
  const total = counted.length

  if (!total) return { invisible: [], total: 0, sentence: 'No completed answers in this run.' }

  if (invisible.length === 0) {
    return {
      invisible,
      total,
      sentence: `Named by every assistant that answered${total === 1 ? '' : ` — all ${total}`}.`,
    }
  }
  if (invisible.length === total) {
    return { invisible, total, sentence: `Not named by a single assistant — 0 of ${total}.` }
  }
  return {
    invisible,
    total,
    sentence: `Invisible to ${invisible.length} of ${total} assistants.`,
  }
}

/** Assistants that declined to answer at all, as opposed to answering about rivals. */
export function hedgers(report: IngestedReport): IngestedReport['assistants'] {
  return report.assistants.filter(a => a.refused > 0)
}

export function intentCoverage(report: IngestedReport): Array<{ intent: string; total: number; named: number }> {
  const buckets = new Map<string, { total: number; named: number }>()
  const questionIntent = new Map(report.questions.map(q => [q.id, q.intent || 'untagged']))
  for (const answer of report.answers) {
    if (answer.error) continue
    const intent = questionIntent.get(answer.questionId) ?? 'untagged'
    const bucket = buckets.get(intent) ?? { total: 0, named: 0 }
    bucket.total += 1
    if (answer.mentioned) bucket.named += 1
    buckets.set(intent, bucket)
  }
  return Array.from(buckets.entries())
    .map(([intent, row]) => ({ intent, ...row }))
    .sort((a, b) => b.total - a.total || a.intent.localeCompare(b.intent))
}
