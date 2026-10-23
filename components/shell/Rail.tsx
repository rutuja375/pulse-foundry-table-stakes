'use client'

/**
 * The rail, with a door.
 *
 * Two states, both explicit: open (268px) and closed (a tab on the left edge
 * that reopens it). No icon-only sliver — a rail of unlabelled glyphs is a
 * puzzle, and the reader here has no patience for one.
 *
 * The choice is remembered in localStorage: an owner who closes the rail to read
 * the report should not have to close it again on every page.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RailProps {
  venue: string
  place: string
  runId: string
  date: string
  rivals: Array<{ name: string; mentions: number; slug: string }>
  actionCount: number | null
}

const STORAGE_KEY = 'pf.rail'

export function Rail({ venue, place, runId, date, rivals, actionCount }: RailProps) {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(true)

  // Read once on mount; default open, because a first-time reader needs the map.
  // `?rail=closed` forces the state without touching the stored preference —
  // useful for screenshots and for sharing a print-ready link.
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get('rail')
    if (forced === 'closed' || forced === 'open') {
      setOpen(forced === 'open')
      return
    }
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) !== 'closed')
    } catch {
      // Private mode / storage disabled: keep the default rather than throwing.
    }
  }, [])

  function toggle(next: boolean) {
    setOpen(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'open' : 'closed')
    } catch {
      // Ignore: the state still works for this page view.
    }
  }

  const onOverview = pathname === '/'
  const onSolutions = pathname.startsWith('/solutions')
  const onNew = pathname.startsWith('/new') || pathname.startsWith('/run')

  return (
    <>
      <aside className={open ? 'rail' : 'rail rail-closed'} aria-hidden={!open}>
        <div className="rail-top">
          <div>
            <div className="rail-brand">AI visibility</div>
            <div className="rail-sub">
              {venue}
              {place ? ` · ${place}` : ''}
            </div>
          </div>
          <button
            type="button"
            className="rail-door"
            onClick={() => toggle(false)}
            aria-label="Close navigation"
            title="Close navigation"
          >
            <ChevronLeft size={16} strokeWidth={1.8} />
          </button>
        </div>

        <Link href="/new" className={onNew ? 'btn btn--primary btn-link rail-new' : 'btn btn--primary btn-link rail-new'}>
          <Plus size={14} strokeWidth={2} />
          New audit
        </Link>

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

      {!open && (
        <button
          type="button"
          className="rail-handle"
          onClick={() => toggle(true)}
          aria-label="Open navigation"
          title="Open navigation"
        >
          <ChevronRight size={15} strokeWidth={1.8} />
          <span>Menu</span>
        </button>
      )}
    </>
  )
}
