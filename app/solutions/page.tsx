import Link from 'next/link'
import { loadLatestRun, rivalFromSlug } from '@/lib/view/load-run'
import { SolutionsClient } from '@/components/solutions/SolutionsClient'

/**
 * Act pane.
 *
 * Until the audit sends its own `actions[]`, the fixes are computed from the
 * run by lib/view/solutions.ts — every one cites the figure it answers — and
 * the "AI" drafts are seeded (lib/solutions/seed.ts). Both are labelled.
 * `?rival=<slug>` arrives from the comparison pane and scopes the list.
 */

export default async function SolutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ rival?: string }>
}) {
  const { rival: slug } = await searchParams
  const loaded = loadLatestRun()
  const rival = loaded && slug ? rivalFromSlug(loaded.report, slug) : null

  return (
    <div className="pane">
      <header className="pane-head">
        <div className="head-row">
          <span className="eyebrow">Act{rival ? ` · solutions for ${rival}` : ''}</span>
          <Link href={rival && slug ? `/compare/${slug}` : '/'} className="back-link">
            ← Back to {rival ? 'the comparison' : 'the report'}
          </Link>
        </div>
        <h1 className="venue-title" style={{ fontSize: 34 }}>
          {rival ? `Fixes for ${rival}` : 'Fixes'}
        </h1>
        <p className="pane-lede">
          {rival
            ? `Scoped to the questions lost to ${rival}: each fix leads with the answers it would win back, and names who took them.`
            : 'Grouped by how badly the questions are going: high means no assistant named you at all on those questions. Each row leads with the count, then the restaurants that took the answers. Open one to review its draft — nothing is sent or published without your approval.'}
        </p>
      </header>

      <section className="blk">
        {loaded ? (
          <SolutionsClient report={loaded.report} rival={rival} />
        ) : (
          <div className="notes">
            <p>No run to act on yet. Start an audit and the fixes appear here.</p>
          </div>
        )}
      </section>

      {loaded && (
        <section className="blk">
          <div className="notes">
            <p>
              <b>How this list was made.</b> Fixes are computed from this run's answers — an intent the assistants
              never matched you to, a rival they keep naming — until the audit sends its own <code>actions[]</code>.
              “Rewrite with AI” shows drafts written ahead of time for this run (seeded preview), not a live model
              call.
            </p>
            <p className="notes-foot">
              Sending and publishing are mocked for the demo. Every external action needs a human to approve it.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
