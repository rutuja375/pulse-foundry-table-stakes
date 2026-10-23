import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ReportView } from '@/components/report/ReportView'
import { ingestRun } from '@/lib/view/ingest'

/**
 * The report renders from a payload it did not produce.
 *
 * Today the payload is a saved run on disk. When the backend team ships an
 * endpoint, only `loadPayload` changes — the ingest layer already accepts the
 * shapes we tested it against, and the report never touches raw JSON.
 */

export const dynamic = 'force-dynamic'

interface Loaded {
  payload: unknown
  source: string
}

function loadPayload(): Loaded | null {
  const dir = join(process.cwd(), 'data', 'runs')
  try {
    const files = readdirSync(dir)
      .filter(name => name.endsWith('.json'))
      .sort()
    if (!files.length) return null
    const file = files[files.length - 1]
    return { payload: JSON.parse(readFileSync(join(dir, file), 'utf8')), source: `data/runs/${file}` }
  } catch {
    return null
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ answer?: string }> }) {
  const params = await searchParams
  const loaded = loadPayload()

  if (!loaded) {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '120px 32px' }}>
        <h1 style={{ fontFamily: 'var(--kpi-font)', fontWeight: 400, fontSize: 32, margin: 0 }}>No run to show</h1>
        <p style={{ color: 'var(--fg2)', fontSize: 14, lineHeight: 1.6 }}>
          Drop a run payload into <code>data/runs/</code> — or point this page at the backend endpoint once it
          exists. The report does not care which shape it receives.
        </p>
      </main>
    )
  }

  const report = ingestRun(loaded.payload)

  return (
    <main>
      <ReportView report={report} initialAnswerKey={params?.answer} />
    </main>
  )
}
