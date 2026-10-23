import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ingestRun, type IngestedReport } from './ingest'
import { adaptBackendRun, isBackendRun } from './backend-run'

/**
 * Server-side payload loading, in one place.
 *
 * Two producers now write into data/runs: this repo's display fixtures, and the
 * Python backend on main (`services/storage.py`). They use different shapes, so
 * the sniff lives here and nowhere else: backend runs are adapted onto the
 * contract, then the same ingest reads both.
 *
 * Newest wins by modification time, not filename — the two producers name their
 * files differently and a slug sorts before a timestamp.
 */

export interface LoadedRun {
  report: IngestedReport
  source: string
  /** 'backend' when the payload came from the Python pipeline. */
  producer: 'backend' | 'fixture'
}

function newestPayload(dir: string): { file: string; payload: unknown } | null {
  try {
    const files = readdirSync(dir).filter(name => name.endsWith('.json'))
    if (!files.length) return null

    const newest = files
      .map(name => ({ name, mtime: statSync(join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0]

    return { file: newest.name, payload: JSON.parse(readFileSync(join(dir, newest.name), 'utf8')) }
  } catch {
    return null
  }
}

export function loadLatestRun(): LoadedRun | null {
  const found = newestPayload(join(process.cwd(), 'data', 'runs'))
  if (!found) return null

  if (isBackendRun(found.payload)) {
    const adapted = adaptBackendRun(found.payload)
    const report = ingestRun(adapted.payload)
    report.issues.unshift(
      'Produced by the audit backend (services/storage.py), adapted to this display. Answers are the models\' JSON replies, and the reasons and sources are the ones the pipeline captured.'
    )

    // A demo subset has to say it is one, in the report, not just in the filename.
    const demoNote = (found.payload as { demo_note?: unknown }).demo_note
    if (typeof demoNote === 'string' && demoNote.trim()) report.issues.unshift(demoNote.trim())

    // Their scorecard is a second opinion on the same answers. Disagreement is
    // surfaced rather than averaged: whoever reads this needs to know which one
    // to trust.
    const reported = adapted.reported
    if (reported) {
      const ours = report.assistants.reduce(
        (acc, assistant) => {
          acc.answered += assistant.answered
          acc.named += assistant.mentioned
          return acc
        },
        { answered: 0, named: 0 }
      )
      const theirMentions = typeof reported.mentions === 'number' ? reported.mentions : null
      const theirAnswered = typeof reported.answered === 'number' ? reported.answered : null

      if (theirMentions !== null && theirAnswered !== null && (theirMentions !== ours.named || theirAnswered !== ours.answered)) {
        report.issues.push(
          `The backend's scorecard reports ${theirMentions} mentions across ${theirAnswered} answers; counting the answers in this payload gives ${ours.named} of ${ours.answered}. The answers win — the scorecard may have been computed on a different model selection.`
        )
      }
    }

    return { report, source: `data/runs/${found.file}`, producer: 'backend' }
  }

  return { report: ingestRun(found.payload), source: `data/runs/${found.file}`, producer: 'fixture' }
}

/** Rivals worth offering in the rail: anyone named at least once. */
export function railRivals(report: IngestedReport, limit = 5): Array<{ name: string; mentions: number; slug: string }> {
  return report.competitors.slice(0, limit).map(row => ({
    name: row.name,
    mentions: row.mentions,
    slug: slugify(row.name),
  }))
}

/** URL-safe, stable across runs so a comparison link survives a re-run. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function rivalFromSlug(report: IngestedReport, slug: string): string | null {
  const hit = report.competitors.find(row => slugify(row.name) === slug)
  return hit ? hit.name : null
}
