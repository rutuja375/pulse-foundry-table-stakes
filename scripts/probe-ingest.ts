/**
 * Adapter proof.
 *
 * The claim under test: the report renders whatever the backend sends, without
 * a code change, and says out loud what it had to assume. Three payloads:
 *
 *   1. A different shape entirely — answers keyed by question, models as bare
 *      strings, names as plain strings, positions as "#2", a human date.
 *   2. A thin payload — no question bank, no per-model block, no detection.
 *   3. A broken payload — wrong types, a null answer, no venue at all.
 *
 * Run: npx tsx scripts/probe-ingest.ts
 */

import { ingestRun } from '../lib/view/ingest'

const shapeA = {
  id: 'run-a',
  date: 'Oct 23, 2026',
  restaurant: { name: 'Café Athena', neighborhood: 'Pacific Beach', city: 'San Diego' },
  answers: {
    'best greek food?': {
      perp: { text: 'Cafe Athena is the top pick.', mentions: ['Cafe Athena', 'Costa Brava'] },
      claude: { text: "I can't verify current listings, so I'd rather not name places.", mentions: [] },
    },
  },
}

const shapeB = {
  runId: 'run-b',
  venue: 'Café Athena',
  answers: [
    { question: 'Where to eat gluten free in PB?', model: 'Gemini', answer: 'The Kebab Shop is the safest bet for gluten-free plates.', recommendations: [{ name: 'The Kebab Shop' }] },
    { question: 'Where to eat gluten free in PB?', model: 'Perplexity', answer: 'Cafe Athena on Garnet has marked gluten-free items.', recommendations: [{ name: 'Cafe Athena', position: '#2' }] },
  ],
}

const shapeC = {
  runId: null,
  venue: null,
  answers: [
    { questionId: 7, model: { label: 'Mystery Assistant' }, answer: null, recommendations: 'not-a-list', error: { message: 'upstream 502' } },
    { questionId: 7, model: 'Mystery Assistant', answer: 'Something about food.', names: [123, null, ''] },
  ],
}

for (const [name, payload] of Object.entries({ 'A · different shape': shapeA, 'B · thin payload': shapeB, 'C · broken payload': shapeC })) {
  const report = ingestRun(payload)
  console.log(`\n${'='.repeat(78)}\n${name}\n${'='.repeat(78)}`)
  console.log(`venue       ${report.venue.name} (${report.venue.neighbourhood || '—'})`)
  console.log(`questions   ${report.totals.questions}   answers ${report.totals.answers}   failed ${report.totals.failed}`)
  for (const row of report.assistants) {
    console.log(
      `  ${row.label.padEnd(20)} named ${row.mentioned}/${row.answered}  ranked ${row.ranked}  refused ${row.refused}  failed ${row.failed}`
    )
  }
  for (const answer of report.answers) {
    const flag = answer.error ? `ERROR(${answer.error})` : answer.refusal ? 'REFUSED' : answer.via ?? 'absent'
    console.log(`  · ${answer.questionId} / ${answer.modelLabel}: ${flag} pos=${answer.position ?? '—'} names=${answer.names.length}`)
  }
  console.log(`  issues (${report.issues.length}):`)
  for (const issue of report.issues) console.log(`    - ${issue}`)
}
