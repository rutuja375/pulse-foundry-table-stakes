import Link from 'next/link'
import { ComparePane } from '@/components/report/ComparePane'
import { loadLatestRun, rivalFromSlug } from '@/lib/view/load-run'

export default async function ComparePage({ params }: { params: Promise<{ rival: string }> }) {
  const { rival: slug } = await params
  const loaded = loadLatestRun()

  if (!loaded) {
    return (
      <div className="pane">
        <h1 className="pane-title">No run to compare</h1>
      </div>
    )
  }

  const rival = rivalFromSlug(loaded.report, slug)

  if (!rival) {
    return (
      <div className="pane">
        <header className="pane-head">
          <div className="head-row">
            <span className="eyebrow">Head to head</span>
            <Link href="/" className="back-link">
              ← Back to the report
            </Link>
          </div>
          <h1 className="venue-title" style={{ fontSize: 32 }}>
            No such restaurant in this run
          </h1>
          <p className="pane-lede">
            No assistant named a restaurant with that name in these answers, so there is nothing to compare. The rail
            lists every restaurant that was actually named.
          </p>
        </header>
      </div>
    )
  }

  return <ComparePane report={loaded.report} rival={rival} slug={slug} />
}
