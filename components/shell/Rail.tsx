'use client'

/**
 * The rail.
 *
 * Adopted from the side-rail mock, which won on one argument: comparing is a
 * three-or-four-names behaviour. An owner pokes at Costa Brava, then the Fish
 * Shop, then The Fishery — in a scrolling document that is a scroll up and a
 * second click each time; here it is one click per name.
 *
 * Rules it follows, from the conventions doc:
 *   - one item highlighted at a time, and it is the page you are on
 *   - the rival list is data, not decoration: only restaurants actually named
 *     in the run appear, with their counts
 *   - counts are mono and right-aligned, so they can be compared down the column
 *   - nothing in the rail needs hover to be understood
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RailProps {
  venue: string
  place: string
  runId: string
  date: string
  rivals: Array<{ name: string; mentions: number; slug: string }>
  actionCount: number | null
}

export function Rail({ venue, place, runId, date, rivals, actionCount }: RailProps) {
  const pathname = usePathname() || '/'
  const onOverview = pathname === '/'
  const onSolutions = pathname.startsWith('/solutions')

  return (
    <aside className="rail">
      <div>
        <div className="rail-brand">AI visibility</div>
        <div className="rail-sub">
          {venue}
          {place ? ` · ${place}` : ''}
        </div>
      </div>

      <nav aria-label="Report sections">
        <div className="rail-group">Report</div>
        <Link href="/" className={onOverview ? 'rail-link active' : 'rail-link'}>
          Overview
        </Link>

        <div className="rail-group">Compare</div>
        {rivals.map(rival => {
          const active = pathname === `/compare/${rival.slug}`
          return (
            <Link
              key={rival.slug}
              href={`/compare/${rival.slug}`}
              className={active ? 'rail-link rail-rival active' : 'rail-link rail-rival'}
            >
              <span>{rival.name}</span>
              <span className="rail-count">{rival.mentions}</span>
            </Link>
          )
        })}
        {!rivals.length && <span className="rail-empty">No rivals named in this run.</span>}

        <div className="rail-group">Act</div>
        <Link href="/solutions" className={onSolutions ? 'rail-link active' : 'rail-link'}>
          <span>Solutions</span>
          {actionCount !== null && <span className="rail-count">{actionCount}</span>}
        </Link>
      </nav>

      <div className="rail-foot">
        <div className="rail-meta">
          {date}
          <br />
          run {runId.slice(0, 22)}
        </div>
        <Button variant="secondary" onClick={() => window.print()} icon={<Printer size={14} strokeWidth={1.8} />}>
          Print / save PDF
        </Button>
      </div>
    </aside>
  )
}
