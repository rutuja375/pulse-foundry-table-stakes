import Link from 'next/link'
import { loadLatestRun, rivalFromSlug } from '@/lib/view/load-run'

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
            ? `This list arrives scoped to the questions lost to ${rival}: each fix names the questions it wins back.`
            : 'Each fix names the questions it wins back, ordered by how much of the gap it closes.'}
        </p>
      </header>

      <section className="blk">
        <div className="notes">
          <p>
            <b>Waiting on the audit.</b> The action list is produced by the audit — one entry per gap, each with the
            finding it answers and the intents it fixes. The display will render it untouched; nothing here is invented
            to fill the space.
          </p>
          <p className="notes-foot">
            Payload shape: <code>actions[]</code> with <code>title</code>, <code>detail</code>, <code>priority</code>,{' '}
            <code>evidence</code>, and <code>fixes: {'{ intents, rivals }'}</code> so the comparison filter can be
            carried through from the pane you came from.
          </p>
        </div>
      </section>
    </div>
  )
}
