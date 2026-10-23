'use client'

/**
 * The two supporting tables.
 *
 * AssistantTable answers "who can see me at all", CompetitorTable answers "who
 * are they seeing instead". Both are deliberately small: the matrix carries the
 * detail, and a second dense table next to it would compete rather than help.
 *
 * Definitions live in tooltips on the header, never in a paragraph above the
 * table — a reader who does not need the definition should not have to read it,
 * and a reader who does should not have to leave the number.
 */

import type { CSSProperties, ReactNode } from 'react'
import { Tooltip } from '@/components/primitives/Tooltip'
import { formatPosition, formatRate } from '@/lib/view/derive'
import type { IngestedAssistant, IngestedReport } from '@/lib/view/ingest'

const headStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: 'var(--muted)',
  textAlign: 'right',
  padding: '12px 14px',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const cellStyle: CSSProperties = {
  padding: '0 14px',
  height: 54,
  borderBottom: '1px solid var(--border)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'var(--font-data)',
  fontSize: 13,
  color: 'var(--fg2)',
}

/**
 * A bar that can actually be compared. The first version was 54x3px, which at
 * a glance read as a dash and made two different counts look identical. Six
 * pixels with a rounded track is the smallest size that reads as a proportion.
 */
function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.min(1, value / max) * 100 : 0
  return (
    <span
      aria-hidden="true"
      style={{ position: 'relative', display: 'inline-block', width: 72, height: 6, background: 'var(--surf-2)', borderRadius: 999, flexShrink: 0 }}
    >
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct}%`,
          minWidth: value > 0 ? 6 : 0,
          background: tone,
          borderRadius: 999,
        }}
      />
    </span>
  )
}

/**
 * Card anatomy, the same on every table in the report: a header that names what
 * you are looking at and what it counts, then the table. Without the header a
 * table is just a grid floating on a page; the label is what makes it a
 * considered object rather than a dump.
 */
function Card({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <div className="data-card">
      <div className="data-card-head">
        <span className="data-card-title">{title}</span>
        {meta && <span className="data-card-meta">{meta}</span>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
    </div>
  )
}

function Head({ label, definition, align = 'right' }: { label: string; definition: string; align?: 'left' | 'right' }) {
  return (
    <th style={{ ...headStyle, textAlign: align }}>
      <Tooltip title={label} content={definition} align={align === 'right' ? 'right' : 'left'} width="250px">
        <span style={{ cursor: 'help', display: 'inline-block' }}>{label}</span>
      </Tooltip>
    </th>
  )
}

export function AssistantTable({ rows }: { rows: IngestedAssistant[] }) {
  const max = Math.max(1, ...rows.map(r => r.answered))
  const answered = rows.reduce((sum, row) => sum + row.answered, 0)

  return (
    <Card title="Assistant coverage" meta={`${rows.length} assistants · ${answered} answers`}>
      <thead>
        <tr>
          <Head label="Assistant" definition="The model queried, not the company's app. Answers come from the API, which has no memory of you and no account history." align="left" />
          <Head label="Named" definition="Answers where this assistant mentioned the venue, ranked or in passing, out of the answers it completed." />
          <Head label="Avg pos" definition="Mean rank across the answers where the venue was ranked. Answers that named it in passing are excluded — they carry no position." />
          <Head label="Declined" definition="Answers where the assistant refused to name any business at all. Not a rival win, and not evidence of invisibility either — it is an answer that answers nothing." />
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.key}>
            <td style={{ ...cellStyle, textAlign: 'left', color: 'var(--fg)' }}>
              <span style={{ fontFamily: 'var(--font-sans)' }}>{row.label}</span>
              {row.grounded && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 9.5,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--brand-teal)',
                    border: '1px solid rgba(79, 98, 91, 0.18)',
                    background: 'rgba(79, 98, 91, 0.08)',
                    borderRadius: 999,
                    padding: '1px 6px',
                    verticalAlign: 'middle',
                  }}
                >
                  grounded
                </span>
              )}
            </td>
            <td style={cellStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                <Bar value={row.mentioned} max={max} tone={row.mentioned === 0 ? 'var(--negative)' : 'var(--active-accent)'} />
                <span style={{ color: row.mentioned === 0 ? 'var(--negative)' : 'var(--fg)', minWidth: 42 }}>
                  {row.mentioned}/{row.answered}
                </span>
              </span>
            </td>
            <td style={cellStyle}>{formatPosition(row.averagePosition)}</td>
            <td style={{ ...cellStyle, color: row.refused ? 'var(--warning)' : 'var(--muted)' }}>{row.refused || '—'}</td>
          </tr>
        ))}
      </tbody>
    </Card>
  )
}

export function CompetitorTable({ report }: { report: IngestedReport }) {
  const targetAnswers = report.answers.filter(a => !a.error)
  const targetNamed = targetAnswers.filter(a => a.mentioned).length
  const rows = report.competitors.slice(0, 8)
  const max = Math.max(1, targetNamed, ...rows.map(r => r.mentions))

  return (
    <Card title="Share of answers" meta={`${report.competitors.length} restaurants named`}>
      <thead>
        <tr>
          <Head label="Named instead" definition="Businesses the assistants recommended in place of the venue, counted once per answer. Unverified names are model output, not a researched competitor set." align="left" />
          <Head label="Answers" definition="How many of the completed answers named this business." />
          <Head label="Share" definition="Answers naming it divided by completed answers. Denominators are always the answers, never the questions, so failed calls cannot inflate anyone's share." />
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ ...cellStyle, textAlign: 'left', color: 'var(--fg)', fontWeight: 600 }}>
            {report.venue.name}
            <span style={{ marginLeft: 8, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>you</span>
          </td>
          <td style={{ ...cellStyle, color: 'var(--fg)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
              <Bar value={targetNamed} max={max} tone="var(--series-1)" />
              {targetNamed}
            </span>
          </td>
          <td style={{ ...cellStyle, color: 'var(--fg)' }}>{formatRate(targetNamed / Math.max(1, targetAnswers.length))}</td>
        </tr>
        {rows.map(row => (
          <tr key={row.name}>
            <td style={{ ...cellStyle, textAlign: 'left', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.name}
            </td>
            <td style={cellStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                <Bar value={row.mentions} max={max} tone="var(--series-2)" />
                {row.mentions}
              </span>
            </td>
            <td style={cellStyle}>{formatRate(row.share)}</td>
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td style={{ ...cellStyle, textAlign: 'left', color: 'var(--muted)' }} colSpan={3}>
              No competitor names in this payload.
            </td>
          </tr>
        )}
      </tbody>
      {report.competitors.length > rows.length && (
        <tfoot>
          <tr>
            <td colSpan={3} className="table-foot">
              {report.competitors.length - rows.length} more restaurants were named, each once — the tail of a
              recommendation list, not rivals to chase.
            </td>
          </tr>
        </tfoot>
      )}
    </Card>
  )
}
