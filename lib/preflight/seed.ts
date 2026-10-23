/**
 * Preflight events — what the screen replays while an audit runs.
 *
 * The source is an interface on purpose. Today it is built from the answers
 * already stored in a run, so the screen is honest: it says it is a seeded
 * preview, and the text you read is real model output from a real run, not
 * lorem ipsum.
 *
 * When the backend lands, one adapter implements `PreflightSource` and streams
 * the same events as they arrive. Nothing in the UI changes.
 */

import type { IngestedReport } from '@/lib/view/ingest'

export type PreflightKind = 'queued' | 'asking' | 'answered' | 'declined' | 'absent' | 'failed'

export interface PreflightEvent {
  /** Milliseconds from the start of the run. */
  at: number
  questionId: string
  questionText: string
  modelKey: string
  modelLabel: string
  kind: PreflightKind
  /** Present when the assistant ranked the venue. */
  position?: number | null
  /** Present when the assistant named anything worth reporting. */
  named?: string | null
  latencyMs?: number | null
  error?: string | null
}

export interface PreflightSeed {
  venue: string
  place: string
  questions: number
  assistants: string[]
  events: PreflightEvent[]
  /** True until a live source replaces this one; the banner reads it. */
  seeded: boolean
}

const ANSWER_GAP_MS = 260

/**
 * Builds the timeline from a stored run: questions in order, assistants in
 * order within each question. "asking" is emitted a beat before the answer so
 * the grid shows work in flight rather than cells popping into existence.
 */
export function seedFromRun(report: IngestedReport): PreflightSeed {
  const events: PreflightEvent[] = []
  let clock = 0

  for (const question of report.questions) {
    for (const assistant of report.assistants) {
      const answer = report.answers.find(a => a.questionId === question.id && a.modelKey === assistant.key)
      const base = {
        questionId: question.id,
        questionText: question.text,
        modelKey: assistant.key,
        modelLabel: assistant.label,
      }

      events.push({ ...base, at: (clock += 90), kind: 'asking' })

      if (!answer || answer.error) {
        events.push({ ...base, at: (clock += ANSWER_GAP_MS), kind: 'failed', error: answer?.error ?? 'no answer' })
        continue
      }

      const kind: PreflightKind = answer.mentioned
        ? 'answered'
        : answer.refusal
          ? 'declined'
          : 'absent'

      events.push({
        ...base,
        at: (clock += ANSWER_GAP_MS),
        kind,
        position: answer.position,
        named: answer.names[0]?.name ?? null,
        latencyMs: answer.latencyMs,
      })
    }
  }

  return {
    venue: report.venue.name,
    place: [report.venue.neighbourhood, report.venue.city].filter(Boolean).join(', '),
    questions: report.totals.questions,
    assistants: report.assistants.map(a => a.key),
    events,
    seeded: true,
  }
}
