'use client'

/**
 * The report.
 *
 * Order of the page is the order a restaurant owner cares: the verdict
 * (headline + four numbers), then who can see them, then the answer-by-answer
 * grid, then who is being named instead, then how to read it. Definitions ride
 * on hover; the evidence is one click behind every cell.
 *
 * Nothing here computes a metric. `ingest` found the data, `derive` counted it,
 * this file places it. That separation is what lets the same components render a
 * payload the backend changes next week without a redesign.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiGrid } from '@/components/primitives/KpiGrid'
import { Drawer } from '@/components/ui/Drawer'
import { MatrixTable } from './MatrixTable'
import { AssistantTable, CompetitorTable } from './SideTables'
import { buildMatrix, formatDate, formatPosition, formatRate, headline, intentCoverage } from '@/lib/view/derive'
import type { IngestedReport } from '@/lib/view/ingest'

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\[(\d+)\]/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function AnswerBody({ text }: { text: string }) {
  const lines = stripMarkdown(text)
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lines.map((line, index) => {
        const bullet = line.match(/^([-*•]|\d+[.)])\s+(.*)$/)
        if (bullet) {
          return (
            <div key={index} style={{ display: 'flex', gap: 10, fontSize: 13.5, lineHeight: 1.55, color: 'var(--fg2)' }}>
              <span style={{ color: 'var(--muted)', minWidth: 14 }}>{/^\d/.test(bullet[1]) ? bullet[1] : '•'}</span>
              <span>{bullet[2]}</span>
            </div>
          )
        }
        return (
          <p key={index} style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--fg2)' }}>
            {line}
          </p>
        )
      })}
    </div>
  )
}

function SectionHead({ index, title, note }: { index: string; title: string; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
      <span style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{index}</span>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, fontFamily: 'var(--kpi-font)', letterSpacing: '-0.01em', color: 'var(--fg)' }}>
        {title}
      </h2>
      {note && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{note}</span>}
    </div>
  )
}

const intentHead: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: 'var(--muted)',
  textAlign: 'right',
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
}

const intentCell: CSSProperties = {
  padding: '0 16px',
  height: 48,
  borderBottom: '1px solid var(--border)',
  textAlign: 'right',
  fontFamily: 'var(--font-data)',
  fontVariantNumeric: 'tabular-nums',
  fontSize: 13,
  color: 'var(--fg2)',
  whiteSpace: 'nowrap',
}

/**
 * The five sections, in the order a reader moves through them. This one list
 * drives the sticky navigation, so a section cannot exist on the page without
 * appearing in the nav — the wayfinding cannot silently drift out of date.
 */
const SECTIONS = [
  { id: 'who', label: 'Who can see you' },
  { id: 'answers', label: 'Every answer' },
  { id: 'rivals', label: 'Named instead' },
  { id: 'intent', label: 'By intent' },
  { id: 'reading', label: 'How this was read' },
] as const

export function ReportView({ report, initialAnswerKey }: { report: IngestedReport; initialAnswerKey?: string }) {
  const matrix = useMemo(() => buildMatrix(report), [report])

  /**
   * Deep link to a single answer: ?answer=<questionId>:<assistantKey>.
   * A report that can be argued with is a better report — and in a pitch it is
   * the difference between "look at this table" and opening on the one answer
   * that makes the point.
   */
  const startIndex = useMemo(() => {
    if (!initialAnswerKey) return null
    const [questionId, modelKey] = initialAnswerKey.split(':')
    const row = matrix.rows.findIndex(r => r.questionId === questionId)
    const column = report.assistants.findIndex(a => a.key === modelKey)
    if (row < 0 || column < 0) return null
    return row * report.assistants.length + column
  }, [initialAnswerKey, matrix.rows, report.assistants])

  const [openIndex, setOpenIndex] = useState<number | null>(startIndex)
  const [activeSection, setActiveSection] = useState<string>('who')
  const navRef = useRef<HTMLElement>(null)

  // Which section am I in? A plain IntersectionObserver, no scroll maths: the
  // nav's job is to answer that question honestly, not to animate.
  useEffect(() => {
    const nodes = SECTIONS.map(section => document.getElementById(section.id)).filter(
      (node): node is HTMLElement => Boolean(node)
    )
    if (!nodes.length) return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setActiveSection(visible.target.id)
      },
      { rootMargin: '-72px 0px -55% 0px', threshold: [0.1, 0.5, 1] }
    )
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [])
  const verdict = useMemo(() => headline(report), [report])
  const coverage = useMemo(() => intentCoverage(report), [report])

  const completed = report.answers.filter(a => !a.error)
  const named = completed.filter(a => a.mentioned).length
  const ranked = completed.filter(a => a.position !== null)
  const avgPosition = ranked.length ? ranked.reduce((s, a) => s + (a.position ?? 0), 0) / ranked.length : null

  const columns = report.assistants.length
  const opened = openIndex === null ? null : matrix.rows[Math.floor(openIndex / columns)]?.cells[openIndex % columns] ?? null
  const openedQuestion = openIndex === null ? null : matrix.rows[Math.floor(openIndex / columns)]

  const location = [report.venue.neighbourhood, report.venue.city].filter(Boolean).join(', ')

  return (
    <>
      <nav className="report-nav" ref={navRef} aria-label="Report sections">
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            minHeight: 56,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--kpi-font)',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              color: 'var(--fg)',
            }}
          >
            {report.venue.name}
          </span>
          <div style={{ display: 'flex', gap: 24, flex: 1, overflowX: 'auto' }}>
            {SECTIONS.map(section => (
              <a key={section.id} href={`#${section.id}`} data-active={activeSection === section.id ? 'true' : 'false'}>
                {section.label}
              </a>
            ))}
          </div>
          <Button variant="secondary" onClick={() => window.print()} icon={<Printer size={14} strokeWidth={1.8} />}>
            Print / save PDF
          </Button>
        </div>
      </nav>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 32px 120px' }}>
      {/* ── Verdict ─────────────────────────────────────────────────────── */}
      <header style={{ borderBottom: '1px solid var(--border)', paddingBottom: 28, marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            AI visibility audit
            {location && <span> · {location}</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {formatDate(report.startedAt)} · run {report.runId}
          </div>
        </div>

        <h1 style={{ margin: '14px 0 0', fontSize: 44, lineHeight: 1.05, fontWeight: 400, fontFamily: 'var(--kpi-font)', letterSpacing: '-0.02em', color: 'var(--fg)' }}>
          {report.venue.name}
        </h1>

        <p style={{ margin: '12px 0 0', fontSize: 19, lineHeight: 1.4, color: verdict.invisible.length ? 'var(--negative)' : 'var(--positive)', fontFamily: 'var(--kpi-font)', maxWidth: '42ch' }}>
          {verdict.sentence}
        </p>

        <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--fg2)', maxWidth: '68ch' }}>
          {report.totals.questions} questions asked of {report.totals.assistants} assistants, {formatDate(report.startedAt)}. Only
          the answers are shown, and every figure on this page is counted from them — verbatim text, one click behind
          each cell.
        </p>
      </header>

      {/* ── Numbers ─────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <KpiGrid
          columns={4}
          items={[
            {
              label: 'Invisible to',
              value: `${verdict.invisible.length} of ${verdict.total}`,
              variant: verdict.invisible.length ? ('neg' as const) : ('pos' as const),
              tooltip:
                'Assistants that never named the venue, of those that answered.\n' +
                `Invisible: ${verdict.invisible.length}\nAnswered: ${verdict.total}\n` +
                'A failed call is excluded, never counted as silence.',
            },
            {
              label: 'Mention rate',
              value: formatRate(named / Math.max(1, completed.length)),
              variant: 'brand-accent' as const,
              tooltip:
                'Share of completed answers that named the venue.\n' +
                `Named: ${named}\nAnswers: ${completed.length}\n` +
                'Ranked and named-in-passing both count here.',
            },
            {
              label: 'Position',
              value: formatPosition(avgPosition),
              tooltip:
                'Mean rank across the answers that ranked the venue.\n' +
                `Ranked answers: ${ranked.length}\n` +
                'Named-in-passing answers carry no position and are excluded.',
            },
            {
              label: 'Answers on record',
              value: String(report.totals.answers),
              tooltip:
                'Verbatim answers stored in this run.\n' +
                `Assistants: ${report.totals.assistants}\nQuestions: ${report.totals.questions}\n` +
                `Failed: ${report.totals.failed}`,
            },
          ]}
        />
      </section>

      {/* ── Who can see you ─────────────────────────────────────────────── */}
      <section id="who" style={{ marginBottom: 44, scrollMarginTop: 72 }}>
        <SectionHead index="01" title="Who can see you" note="hover a column heading for its definition" />
        <AssistantTable rows={report.assistants} />
      </section>

      {/* ── The matrix ──────────────────────────────────────────────────── */}
      <section id="answers" style={{ marginBottom: 44, scrollMarginTop: 72 }}>
        <SectionHead index="02" title="Every answer, by question" note="click any cell to read what was said" />
        <MatrixTable rows={matrix.rows} assistants={report.assistants} onOpen={setOpenIndex} />
        <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)' }}>
          <span><span style={{ color: 'var(--fg)', fontFamily: 'var(--kpi-font)', fontSize: 13 }}>#3</span> ranked third</span>
          <span>named — no ranking given</span>
          <span style={{ color: 'var(--warning)' }}>declined — assistant refused to name any business</span>
          <span style={{ color: 'var(--muted)' }}>· answered, named others</span>
          <span style={{ color: 'var(--negative)' }}>failed — excluded from every rate</span>
        </div>
      </section>

      {/* ── Who is named instead ────────────────────────────────────────── */}
      <section id="rivals" style={{ marginBottom: 44, scrollMarginTop: 72 }}>
        <SectionHead index="03" title="Who is named instead" note="counted once per answer" />
        <CompetitorTable report={report} />
      </section>

      {/* ── Segment coverage ────────────────────────────────────────────── */}
      {coverage.length > 0 && (
        <section id="intent" style={{ marginBottom: 44, scrollMarginTop: 72 }}>
          <SectionHead index="04" title="By customer intent" note="where the gap is concentrated" />
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--card-radius)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...intentHead, textAlign: 'left', width: '34%' }}>Intent</th>
                  <th style={intentHead}>Named</th>
                  <th style={{ ...intentHead, width: '38%' }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map(row => {
                  const rate = row.named / Math.max(1, row.total)
                  return (
                    <tr key={row.intent}>
                      <td style={{ ...intentCell, textAlign: 'left', color: 'var(--fg)' }}>{row.intent}</td>
                      <td style={intentCell}>
                        {row.named} of {row.total}
                      </td>
                      <td style={intentCell}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', width: '100%' }}>
                          <span
                            aria-hidden="true"
                            style={{ position: 'relative', width: 120, height: 6, background: 'var(--surf-2)', borderRadius: 999 }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${rate * 100}%`,
                                minWidth: row.named > 0 ? 6 : 0,
                                background: rate === 0 ? 'var(--negative)' : 'var(--accent)',
                                borderRadius: 999,
                              }}
                            />
                          </span>
                          <span style={{ minWidth: 44, color: rate === 0 ? 'var(--negative)' : 'var(--fg)' }}>{formatRate(rate)}</span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── How this was read ───────────────────────────────────────────── */}
      <section id="reading" style={{ scrollMarginTop: 72 }}>
        <SectionHead index="05" title="How this was read" note="assumptions the display had to make" />
        <div
          style={{
            background: 'var(--surf-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--card-radius)',
            padding: '18px 20px',
          }}
        >
          {report.issues.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {report.issues.map(issue => (
                <li key={issue} style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--fg2)' }}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg2)' }}>
              Every field arrived where it was expected. No assumptions were needed.
            </p>
          )}
          <p style={{ margin: '14px 0 0', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            Answers are measured on one platform per assistant, without browsing history, memory or personalisation.
            A mention is a mention in the answer text; a position is only recorded when the answer ranked the venue.
          </p>
        </div>
      </section>

      {/* ── Evidence drawer ─────────────────────────────────────────────── */}
      <Drawer
        open={Boolean(opened?.answer)}
        onClose={() => setOpenIndex(null)}
        title={opened?.answer?.modelLabel ?? ''}
        subtitle={openedQuestion?.text}
        width={620}
        footer={
          opened?.answer ? (
            <div style={{ display: 'flex', gap: 18, fontSize: 11.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
              <span>{opened.kind === 'ranked' ? `Ranked #${opened.position}` : opened.kind === 'passing' ? 'Named, not ranked' : opened.kind === 'refused' ? 'Declined to name any business' : opened.kind === 'error' ? `Failed: ${opened.answer.error}` : 'Answered about other restaurants'}</span>
              {opened.answer.latencyMs !== null && <span>{Math.round(opened.answer.latencyMs / 100) / 10}s</span>}
              <span>{openedQuestion?.intent || 'untagged'}</span>
            </div>
          ) : null
        }
      >
        {opened?.answer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {opened.answer.error ? (
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--negative)' }}>
                The request failed ({opened.answer.error}). This cell is excluded from every rate rather than counted as a miss.
              </p>
            ) : (
              <AnswerBody text={opened.answer.answer || 'The payload held no answer text for this cell.'} />
            )}

            {opened.answer.names.length > 0 && (
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                  What the answer named
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {opened.answer.names.map((entry, index) => (
                    <li key={`${entry.name}-${index}`} style={{ fontSize: 13, color: 'var(--fg2)' }}>
                      {entry.name}
                      <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {entry.basis === 'ranked' ? `#${entry.position}` : 'named in passing'}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </Drawer>
      </div>
    </>
  )
}
