'use client'

/**
 * The preflight screen — what the audit looks like while it runs.
 *
 * Why it exists: an owner who pays for an audit and watches nothing happen for
 * ninety seconds assumes it is broken. This shows the work — which assistant is
 * being asked what, and what came back — as it happens.
 *
 * Honesty rule: while the source is seeded, the banner says so and says the
 * answers are real output from a stored run, not a fabricated animation.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { PreflightEvent, PreflightSeed } from '@/lib/preflight/seed'

type CellState = { kind: string; position?: number | null; named?: string | null; error?: string | null }

function clock(ms: number): string {
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function RunClient({
  seed,
  requested,
  replayOf,
}: {
  seed: PreflightSeed
  /** What the start form asked for, when it differs from the stored run. */
  requested?: string | null
  replayOf?: string
}) {
  const [cursor, setCursor] = useState(0)
  const [paused, setPaused] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const questions = useMemo(() => {
    const seen: Array<{ id: string; text: string }> = []
    for (const event of seed.events) {
      if (!seen.some(q => q.id === event.questionId)) seen.push({ id: event.questionId, text: event.questionText })
    }
    return seen
  }, [seed.events])

  const assistants = useMemo(() => {
    const seen: Array<{ key: string; label: string }> = []
    for (const event of seed.events) {
      if (!seen.some(a => a.key === event.modelKey)) seen.push({ key: event.modelKey, label: event.modelLabel })
    }
    return seen
  }, [seed.events])

  // Play the timeline. 1x by default; the control below lets a presenter speed it up.
  const [speed, setSpeed] = useState(1)
  useEffect(() => {
    if (paused || cursor >= seed.events.length) return
    const current = seed.events[cursor]
    const next = seed.events[cursor + 1]
    const gap = next ? Math.max(60, (next.at - current.at) / speed) : 0
    const timer = setTimeout(() => setCursor(c => c + 1), gap)
    return () => clearTimeout(timer)
  }, [cursor, paused, seed.events, speed])

  const applied = useMemo(() => {
    const map = new Map<string, CellState>()
    for (let i = 0; i < cursor; i += 1) {
      const event = seed.events[i]
      map.set(`${event.questionId}:${event.modelKey}`, {
        kind: event.kind,
        position: event.position,
        named: event.named,
        error: event.error,
      })
    }
    return map
  }, [cursor, seed.events])

  const answered = Array.from(applied.values()).filter(cell => ['answered', 'declined', 'absent', 'failed'].includes(cell.kind)).length

  /**
   * The feed window. Constants are here rather than in CSS so the rule reads as
   * a rule: five crisp, the next three fading, everything older dropped.
   */
  const CRISP = 5
  const MAX_VISIBLE = 8

  // Age is measured inside the feed, not against the global event index — the
  // first version used the event index and every row got the same fade.
  const feed = seed.events.slice(0, cursor).filter(event => event.kind !== 'asking')
  const windowed = feed.slice(-MAX_VISIBLE)

  const visible = windowed.map((event, position) => {
    const age = windowed.length - 1 - position
    const opacity = age < CRISP ? 1 : age === CRISP ? 0.55 : age === CRISP + 1 ? 0.35 : 0.18
    const text =
      event.kind === 'answered'
        ? event.position
          ? `named at #${event.position}`
          : `named ${event.named ?? 'a business'}, unranked`
        : event.kind === 'declined'
          ? 'declined to name any business'
          : event.kind === 'failed'
            ? `failed — ${event.error ?? 'unknown error'}`
            : 'named other restaurants'
    const tone = event.kind === 'answered' ? 'good' : event.kind === 'declined' ? 'warn' : event.kind === 'failed' ? 'bad' : 'mute'
    const key = `${event.questionId}:${event.modelKey}:${event.at}`
    return { event, opacity, text, tone, key, age }
  })
  const hiddenCount = Math.max(0, feed.length - visible.length)
  const total = questions.length * assistants.length
  const complete = answered >= total
  const current = cursor > 0 ? seed.events[cursor - 1] : null
  const elapsed = current?.at ?? 0

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [cursor])

  return (
    <div className="pane">
      <header className="pane-head">
        <div className="head-row">
          <span className="eyebrow">Preflight · asking the assistants</span>
          <span className="eyebrow mono-label-soft">{clock(elapsed)} elapsed</span>
        </div>
        <h1 className="venue-title" style={{ fontSize: 34 }}>
          {seed.venue}
        </h1>
        <p className="pane-lede">
          {total} answers to collect — {questions.length} questions across {assistants.length} assistants
          {seed.place ? `, ${seed.place}` : ''}. Each call is one question, answered in its own words.
        </p>
      </header>

      {seed.seeded && (
        <div className="banner">
          <b>Seeded preview.</b> These are real answers from the stored {replayOf ?? 'example'} run, replayed so the
          flow can be shown before the live pipeline is wired.
          {requested && replayOf && requested.toLowerCase() !== replayOf.toLowerCase() ? (
            <>
              {' '}
              You asked about <b>{requested}</b> — the run below is still {replayOf}. Nothing here is a measurement of{' '}
              {requested}; it is a stand-in for the screen.
            </>
          ) : null}{' '}
          The moment a live source emits the same events, this banner disappears and nothing else changes.
        </div>
      )}

      <section className="progress-wrap">
        <div className="progress-head">
          <span className="progress-count">
            {answered} of {total} answers
          </span>
          <span className="progress-state">{complete ? 'Complete' : paused ? 'Paused' : 'Working'}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(answered / Math.max(1, total)) * 100}%` }} />
        </div>
        <div className="progress-actions">
          <button type="button" className="link-btn" onClick={() => setPaused(p => !p)} disabled={complete}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="link-btn" onClick={() => setSpeed(s => (s === 1 ? 2 : s === 2 ? 4 : 1))} disabled={complete}>
            Speed {speed}×
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => setCursor(seed.events.length)}
            disabled={complete}
          >
            Skip to the end
          </button>
        </div>
      </section>

      {/*
        The feed. Answers arrive at the bottom and push the older ones up, like a
        terminal you can read. Five stay crisp; the next three fade as evidence
        that something came before; anything older than the eighth is dropped —
        the run is long and the reader only needs to see what just arrived.
      */}
      <section className="feed-wrap">
        <div className="feed-head">
          <span className="eyebrow">Responses</span>
          <span className="feed-hint">
            {hiddenCount > 0 ? `${hiddenCount} earlier response${hiddenCount === 1 ? '' : 's'} cleared` : 'newest at the bottom'}
          </span>
        </div>

        <div className="feed" aria-live="polite">
          {visible.length === 0 && <div className="feed-empty">Waiting for the first answer…</div>}
          {visible.map(item => (
            <article
              key={item.key}
              className={`feed-item feed-${item.event.kind}`}
              style={{ opacity: item.opacity }}
              aria-hidden={item.opacity < 0.5}
            >
              <span className="feed-time">{clock(item.event.at)}</span>
              <div className="feed-body">
                <div className="feed-line">
                  <span className="feed-model">{item.event.modelLabel.split('(')[0].trim()}</span>
                  <span className={`feed-result ${item.tone}`}>{item.text}</span>
                </div>
                <div className="feed-question">{item.event.questionText}</div>
              </div>
              {item.event.latencyMs ? <span className="feed-latency">{(item.event.latencyMs / 1000).toFixed(1)}s</span> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="cta">
        <div>
          <div className="cta-title">{complete ? 'Audit complete' : 'Collecting answers'}</div>
          <div className="cta-sub">
            {complete
              ? 'The report opens with these answers already counted — every number traces back to a line in the activity log.'
              : 'You can open the report at any point; it counts whatever has arrived.'}
          </div>
        </div>
        <Link href="/" className={`btn btn-link ${complete ? 'btn--primary' : 'btn--secondary'}`}>
          {complete ? 'View the report →' : 'Open the report'}
        </Link>
      </section>
    </div>
  )
}
