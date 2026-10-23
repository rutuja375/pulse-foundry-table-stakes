import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ingestRun, type IngestedReport } from './ingest'

/**
 * Server-side payload loading, in one place.
 *
 * Today the payload is the newest file in data/runs. When the backend ships an
 * endpoint this function changes and nothing else does — the panes never touch
 * the filesystem and never touch raw JSON.
 */

export interface LoadedRun {
  report: IngestedReport
  source: string
}

export function loadLatestRun(): LoadedRun | null {
  const dir = join(process.cwd(), 'data', 'runs')
  try {
    const files = readdirSync(dir)
      .filter(name => name.endsWith('.json'))
      .sort()
    if (!files.length) return null
    const file = files[files.length - 1]
    const payload = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    return { report: ingestRun(payload), source: `data/runs/${file}` }
  } catch {
    return null
  }
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
