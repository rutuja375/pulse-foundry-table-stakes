'use client'

/**
 * The Act pane: fixes as a list, the work in a drawer.
 *
 * Each fix moves draft → approved → done. Approving and sending are two clicks
 * on purpose: nothing goes out without a human saying yes, and the UI makes
 * that yes visible. "Done" is a mock — no email is sent, no page is published,
 * and the drawer says so.
 *
 * "Rewrite with AI" replays a seeded draft (lib/solutions/seed.ts) and labels
 * it seeded. When the audit sends its own drafts, only the source changes.
 *
 * Progress is remembered per run on this device. Storage can be unavailable;
 * the pane works without it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Code2, Globe, Mail, RotateCcw, Sparkles } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/button'
import { EmailDraft, SnippetApply, WebsiteChange, countBlanks } from './Handoffs'
import { buildFixes, fixesForRival, type Fix, type Handoff, type Priority } from '@/lib/view/solutions'
import { SEEDED_DELAY_MS, seededRewrites } from '@/lib/solutions/seed'
import type { IngestedReport } from '@/lib/view/ingest'

type Status = 'draft' | 'approved' | 'done'

interface FixState {
  handoff: Handoff
  status: Status
  source: 'template' | 'seeded'
  doneAt: string | null
}

const KIND_META: Record<Handoff['kind'], { icon: typeof Mail; noun: string; doVerb: string; doneLabel: string }> = {
  email: { icon: Mail, noun: 'Email draft', doVerb: 'Send email', doneLabel: 'Sent' },
  website: { icon: Globe, noun: 'Website change', doVerb: 'Publish change', doneLabel: 'Live' },
  snippet: { icon: Code2, noun: 'Code snippet', doVerb: 'Mark as installed', doneLabel: 'Installed' },
}

const PRIORITY_STYLE: Record<Priority, CSSProperties> = {
  high: { color: 'var(--negative)', borderColor: 'var(--negative)' },
  medium: { color: 'var(--warning)', borderColor: 'var(--warning)' },
  low: { color: 'var(--muted)', borderColor: 'var(--border-strong)' },
}

function storageKey(runId: string) {
  return `pf.solutions.${runId}`
}

function initialState(fixes: Fix[]): Record<string, FixState> {
  return Object.fromEntries(
    fixes.map(f => [f.id, { handoff: f.handoff, status: 'draft' as Status, source: 'template' as const, doneAt: null }])
  )
}

function domainFor(name: string): string {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  return `${base || 'yoursite'}.com`
}

function timeOf(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// ── Row ─────────────────────────────────────────────────────────────────────

function StatusLabel({ fix, state }: { fix: Fix; state: FixState }) {
  const meta = KIND_META[fix.handoff.kind]
  const text = state.status === 'done' ? `${meta.doneLabel} ✓` : state.status === 'approved' ? 'Approved' : 'Draft ready'
  const color = state.status === 'done' ? 'var(--brand-teal)' : state.status === 'approved' ? 'var(--accent)' : 'var(--muted)'
  return <span style={{ fontSize: 11, letterSpacing: '0.06em', color, fontWeight: 700, whiteSpace: 'nowrap' }}>{text}</span>
}

/**
 * The row's lead: the arithmetic, then who took the answers.
 *
 * An owner reading a fix needs the size of the hole before the instruction.
 * "0/7" in the figure face, a bar that shows the seven answers split between
 * the rivals who got them, and the names underneath with their counts. A fix
 * with no gap of its own says so instead of inventing one.
 */
function GapLead({ fix }: { fix: Fix }) {
  if (!fix.gap) {
    return (
      <div className="fix-gap">
        <div className="fix-gap-figure" style={{ color: 'var(--muted)' }}>
          ↑
        </div>
        <div className="fix-gap-label">supports the fixes above</div>
      </div>
    )
  }

  const { total, named } = fix.gap
  // Two names fit the column; the counts underneath carry the rest.
  const who = fix.gap.who.slice(0, 2)
  const share = (value: number) => `${(value / Math.max(1, total)) * 100}%`
  const extra = fix.gap.intents.length - 1

  return (
    <div className="fix-gap">
      <div className="fix-gap-figure">
        {named}
        <span className="fix-gap-of">/{total}</span>
      </div>
      <div className="fix-gap-label">
        {fix.gap.intent || 'all'} answers name you
        {extra > 0 ? ` · ${extra} more intent${extra === 1 ? '' : 's'} below` : ''}
      </div>
      {/*
        * Two parts, not one per rival. A single answer can name Costa Brava and
        * Flamingo Deck, so rival counts do not partition the answers — a stacked
        * bar read "0 of 3" with two 2s in it. This bar answers one question
        * (how much of the intent names you) and the names below answer the other.
        */}
      <div className="gap-bar" aria-hidden="true">
        {named > 0 && <span className="gap-bar-you" style={{ width: share(named) }} />}
        <span className="gap-bar-them" style={{ width: share(Math.max(0, total - named)) }} />
      </div>
      <div className="fix-gap-who">
        {who.length ? (
          who.map(entry => (
            <span key={entry.name}>
              {entry.name} <b>{entry.mentions}</b>
            </span>
          ))
        ) : (
          <span>nobody named a rival here</span>
        )}
      </div>
    </div>
  )
}

function FixRow({ fix, state, onOpen }: { fix: Fix; state: FixState; onOpen: () => void }) {
  const meta = KIND_META[fix.handoff.kind]
  const Icon = meta.icon
  const done = state.status === 'done'

  return (
    <article
      className="fix-row"
      style={{
        opacity: done ? 0.6 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      <GapLead fix={fix} />

      <div style={{ minWidth: 0 }}>
        <h3
          className="section-title"
          style={{ textDecoration: done ? 'line-through' : 'none', textDecorationColor: 'var(--muted)' }}
        >
          {fix.title}
        </h3>
        <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--fg2)', maxWidth: '70ch' }}>{fix.why}</p>
        <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* When the row already leads with its gap, repeating that figure here
              would say the same thing twice in two sizes. Only the rest show. */}
          {(fix.gap && fix.gap.intent ? fix.moreEvidence : [fix.evidence]).map(figure => (
            <span key={figure} className="fix-evidence">
              {figure}
            </span>
          ))}
          {fix.example && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>e.g. “{fix.example}”</span>}
        </div>
      </div>

      <div className="fix-act">
        <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-data)', lineHeight: 1.5 }}>
          {fix.effort}
          <br />
          {fix.impact} impact
        </div>
        <StatusLabel fix={fix} state={state} />
        <Button variant="secondary" onClick={onOpen} icon={<Icon size={14} strokeWidth={1.8} />} style={{ minHeight: 34, fontSize: 12.5 }}>
          {done ? 'View' : meta.noun}
          <ArrowRight size={13} strokeWidth={1.8} />
        </Button>
      </div>
    </article>
  )
}

// ── Pane body ───────────────────────────────────────────────────────────────

export function SolutionsClient({ report, rival }: { report: IngestedReport; rival: string | null }) {
  const allFixes = useMemo(() => buildFixes(report), [report])
  const fixes = useMemo(() => (rival ? fixesForRival(allFixes, rival) : allFixes), [allFixes, rival])
  const source = useMemo(() => seededRewrites(report.venue.name), [report.venue.name])

  const [states, setStates] = useState<Record<string, FixState>>(() => initialState(allFixes))
  const [openId, setOpenId] = useState<string | null>(null)
  const [rewriting, setRewriting] = useState(false)

  // Restore after mount, so the server render and the first client render agree.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(report.runId))
      if (!saved) return
      const parsed = JSON.parse(saved) as Record<string, FixState>
      setStates(current => {
        const next = { ...current }
        for (const id of Object.keys(next)) {
          if (parsed[id]?.handoff?.kind === next[id].handoff.kind) next[id] = parsed[id]
        }
        return next
      })
    } catch {
      // Storage unavailable or corrupt: start from the templates.
    }
  }, [report.runId])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(report.runId), JSON.stringify(states))
    } catch {
      // Not fatal: progress just will not survive a reload.
    }
  }, [states, report.runId])

  const update = useCallback((id: string, patch: Partial<FixState>) => {
    setStates(current => ({ ...current, [id]: { ...current[id], ...patch } }))
  }, [])

  const close = useCallback(() => setOpenId(null), [])

  const fix = allFixes.find(f => f.id === openId) ?? null
  const state = fix ? states[fix.id] : null
  const canRewrite = Boolean(fix && state && source.rewrite(fix.template, state.handoff))
  const doneCount = fixes.filter(f => states[f.id]?.status === 'done').length

  const rewrite = () => {
    if (!fix || !state) return
    const next = source.rewrite(fix.template, state.handoff)
    if (!next) return
    setRewriting(true)
    window.setTimeout(() => {
      update(fix.id, { handoff: next, source: 'seeded' })
      setRewriting(false)
    }, SEEDED_DELAY_MS)
  }

  const meta = fix ? KIND_META[fix.handoff.kind] : null
  const blanks = state ? countBlanks(state.handoff) : 0
  const locked = state?.status !== 'draft'
  const missingRecipient = state?.handoff.kind === 'email' && !state.handoff.to.trim()

  return (
    <>
      {rival && (
        <div className="notes" style={{ marginBottom: 18 }}>
          <p>
            Showing {fixes.length} of {allFixes.length} fixes — the ones that win back questions where assistants named{' '}
            <b>{rival}</b>. <Link href="/solutions" className="back-link">Show all fixes</Link>
          </p>
        </div>
      )}

      {fixes.length === 0 ? (
        <div className="notes">
          <p>
            {rival
              ? `No fix in this run is tied to ${rival}. The full list may still help.`
              : 'No gap in this run is large enough to act on. Re-run after the next menu or site change to keep it that way.'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="bar-track" aria-hidden="true" style={{ width: 200 }}>
              <span
                className="bar-fill"
                style={{ width: `${(doneCount / fixes.length) * 100}%`, background: 'var(--brand-teal)', transition: 'width 300ms ease' }}
              />
            </span>
            <span style={{ fontSize: 12, color: 'var(--fg2)', fontFamily: 'var(--font-data)' }}>
              {doneCount} of {fixes.length} handed off
            </span>
            <span className="section-note">· every draft waits for your approval before anything goes out</span>
          </div>

          {/*
            * Priority ladder, not one long list. Six equal-weight rows gave an
            * owner no starting point; two bands say where the silence is total
            * and where it is partial, and the sort inside a band stays by the
            * number of answers lost.
            */}
          {(
            [
              { priority: 'high' as Priority, note: 'no assistant named you on these questions' },
              { priority: 'medium' as Priority, note: 'named on some, but not most' },
              { priority: 'low' as Priority, note: 'already named on most of these' },
            ] as const
          ).map(band => {
            const inBand = fixes.filter(f => f.priority === band.priority)
            if (!inBand.length) return null
            return (
              <section key={band.priority} className="fix-band">
                <div className="fix-band-head">
                  <span className="fix-band-label" style={PRIORITY_STYLE[band.priority]}>
                    {band.priority}
                  </span>
                  <span className="fix-band-note">{band.note}</span>
                  <span className="fix-band-count">
                    {inBand.length} {inBand.length === 1 ? 'fix' : 'fixes'}
                  </span>
                </div>
                <div className="fix-rows">
                  {inBand.map(f => (
                    <FixRow key={f.id} fix={f} state={states[f.id]} onOpen={() => setOpenId(f.id)} />
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}

      <Drawer
        open={Boolean(fix)}
        onClose={close}
        title={fix?.title ?? ''}
        subtitle={fix ? `${meta?.noun} · ${fix.evidence}` : undefined}
        width={640}
        footer={
          fix && state && meta ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {state.status === 'draft' && (
                <>
                  {canRewrite && (
                    <Button variant="secondary" onClick={rewrite} loading={rewriting} icon={<Sparkles size={14} strokeWidth={1.8} />}>
                      Rewrite with AI
                    </Button>
                  )}
                  <span style={{ flex: 1, fontSize: 11.5, color: missingRecipient ? 'var(--warning)' : 'var(--muted)' }}>
                    {missingRecipient
                      ? 'Add a recipient to approve.'
                      : blanks
                        ? `${blanks} blank${blanks === 1 ? '' : 's'} like [this] left to fill.`
                        : 'Ready for your review.'}
                  </span>
                  <Button variant="primary" onClick={() => update(fix.id, { status: 'approved' })} disabled={missingRecipient}>
                    Approve
                  </Button>
                </>
              )}

              {state.status === 'approved' && (
                <>
                  <Button variant="quiet" onClick={() => update(fix.id, { status: 'draft' })}>
                    Back to editing
                  </Button>
                  <span style={{ flex: 1 }} />
                  <Button variant="primary" onClick={() => update(fix.id, { status: 'done', doneAt: new Date().toISOString() })}>
                    {meta.doVerb} (demo)
                  </Button>
                </>
              )}

              {state.status === 'done' && (
                <>
                  <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--brand-teal)' }}>
                    <Check size={15} /> {meta.doneLabel} {timeOf(state.doneAt)}
                    <span style={{ color: 'var(--muted)' }}>· demo — nothing left this computer</span>
                  </span>
                  <Button
                    variant="quiet"
                    onClick={() => update(fix.id, { status: 'draft', doneAt: null })}
                    icon={<RotateCcw size={13} strokeWidth={1.8} />}
                  >
                    Reset
                  </Button>
                </>
              )}
            </div>
          ) : null
        }
      >
        {fix && state && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--fg2)' }}>{fix.why}</p>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--muted)' }}>
              <span>Priority: {fix.priority}</span>
              <span>Effort: {fix.effort}</span>
              <span>Impact: {fix.impact}</span>
              <span>Draft: {state.source === 'seeded' ? 'AI draft · seeded preview' : 'template from your report'}</span>
            </div>

            {state.handoff.kind === 'email' && (
              <EmailDraft
                value={state.handoff}
                onChange={handoff => update(fix.id, { handoff })}
                locked={locked}
                suggestedBy={state.source === 'seeded' ? 'model' : 'template'}
              />
            )}
            {state.handoff.kind === 'website' && (
              <WebsiteChange
                value={state.handoff}
                onChange={handoff => update(fix.id, { handoff })}
                locked={locked}
                domain={domainFor(report.venue.name)}
              />
            )}
            {state.handoff.kind === 'snippet' && (
              <SnippetApply value={state.handoff} onChange={handoff => update(fix.id, { handoff })} locked={locked} />
            )}

            {state.status === 'approved' && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--accent)' }}>Approved and locked. Go back to editing to change it.</p>
            )}
          </div>
        )}
      </Drawer>
    </>
  )
}
