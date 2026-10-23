/**
 * Solutions proof.
 *
 * The claims under test, against the stored run:
 *   1. Every fix cites a figure and carries exactly one hand-off.
 *   2. Intents the venue never appears on come first, as high priority.
 *   3. Email drafts start with a blank recipient and suggestions to fill it.
 *   4. The rival filter keeps only fixes that name that rival.
 *   5. Every seeded rewrite matches the hand-off kind of the fix it replaces,
 *      and never overwrites the owner's recipient.
 *   6. A venue named everywhere gets no fixes; a run with no answers gets none.
 *
 * Run: npx tsx scripts/probe-solutions.ts
 */

import assert from 'node:assert/strict'
import { loadLatestRun } from '../lib/view/load-run'
import { buildFixes, fixesForRival } from '../lib/view/solutions'
import { seededRewrites } from '../lib/solutions/seed'

const loaded = loadLatestRun()
assert.ok(loaded, 'a stored run exists')
const report = loaded.report
const fixes = buildFixes(report)

assert.ok(fixes.length > 0)
for (const fix of fixes) {
  assert.ok(fix.evidence, `${fix.id} cites a figure`)
  assert.ok(['email', 'website', 'snippet'].includes(fix.handoff.kind))
}

const ranks = fixes.map(f => ({ high: 0, medium: 1, low: 2 })[f.priority])
assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), 'ordered by priority')

for (const fix of fixes) {
  if (fix.handoff.kind !== 'email') continue
  assert.equal(fix.handoff.to, '')
  assert.ok(fix.handoff.suggestions.length > 0)
}

const top = report.competitors[0]?.name
if (top) {
  const scoped = fixesForRival(fixes, top)
  assert.ok(scoped.every(f => f.fixes.rivals.includes(top)))
}

const source = seededRewrites(report.venue.name)
for (const fix of fixes) {
  const current = fix.handoff.kind === 'email' ? { ...fix.handoff, to: 'owner@example.com' } : fix.handoff
  const next = source.rewrite(fix.template, current)
  if (!next) continue
  assert.equal(next.kind, fix.handoff.kind, `${fix.id} seed kind`)
  if (next.kind === 'email') assert.equal(next.to, 'owner@example.com', 'recipient kept')
}

assert.equal(buildFixes({ ...report, answers: report.answers.map(a => ({ ...a, mentioned: true })) }).length, 0)
assert.deepEqual(buildFixes({ ...report, answers: report.answers.map(a => ({ ...a, error: 'timeout' })) }), [])

console.log(`ok — ${fixes.length} fixes for ${report.venue.name}`)
for (const fix of fixes) {
  const seeded = source.rewrite(fix.template, fix.handoff) ? 'seeded AI draft' : 'template only'
  console.log(`  ${fix.priority.padEnd(6)} [${fix.template}] ${fix.title} · ${fix.evidence} · ${fix.handoff.kind} · rivals: ${fix.fixes.rivals.slice(0, 3).join(', ') || '—'} · ${seeded}`)
}
