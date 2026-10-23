'use client'

/**
 * The answer matrix — the centre of the report.
 *
 * One row per question, one column per assistant, one cell per answer. It is a
 * table rather than a chart on purpose: the reader's question is "where exactly
 * am I missing", and that is a grid question. A chart of mention rates would
 * answer a different, easier question and hide the specific rows that matter.
 *
 * The cell vocabulary carries the findings the raw data forced:
 *   #3        ranked third
 *   named     named without a ranking — real, but not a position
 *   declined  the assistant refused to name any business at all
 *   ·         answered about other restaurants
 *   failed    the call failed; never rendered as a zero
 *
 * Every cell opens the verbatim answer. The claim and its evidence are one click
 * apart, which is the only way a restaurant owner can check us.
 */

import type { CSSProperties } from 'react'
import { Tooltip } from '@/components/primitives/Tooltip'
import type { Cell } from '@/lib/view/derive'

interface Assistant {
  key: string
  label: string
  grounded: boolean
}

interface Row {
  questionId: string
  text: string
  intent: string
  cells: Cell[]
}

const CELL_COPY: Record<Cell['kind'], { label: string; title: string }> = {
  ranked: { label: '', title: 'Ranked in the answer' },
  passing: { label: 'named', title: 'Named, but never ranked — no position to record' },
  refused: { label: 'declined', title: 'The assistant declined to name any business' },
  absent: { label: '—', title: 'Answered, recommended other restaurants' },
  error: { label: 'failed', title: 'The request failed — excluded from every rate' },
  missing: { label: '', title: 'No answer for this pair' },
}

function cellStyle(cell: Cell): CSSProperties {
  const base: CSSProperties = {
    textAlign: 'center',
    padding: '0 10px',
    height: 52,
    borderBottom: '1px solid var(--border)',
    fontFamily: 'var(--font-data)',
    fontVariantNumeric: 'tabular-nums',
    fontSize: 13,
  }
  switch (cell.kind) {
    case 'ranked':
      return { ...base, color: 'var(--fg)', fontFamily: 'var(--kpi-font)', fontSize: 17, fontWeight: 500 }
    case 'passing':
      return { ...base, color: 'var(--fg2)', fontSize: 11.5, letterSpacing: '0.02em' }
    case 'refused':
      return { ...base, color: 'var(--warning)', fontSize: 11.5 }
    case 'absent':
      return { ...base, color: 'var(--muted)', fontSize: 13 }
    case 'error':
      return { ...base, color: 'var(--negative)', fontSize: 11.5 }
    default:
      return { ...base, color: 'var(--surf-3)' }
  }
}

export function MatrixTable({
  rows,
  assistants,
  onOpen,
}: {
  rows: Row[]
  assistants: Assistant[]
  onOpen: (index: number) => void
}) {
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--card-radius)',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table
          aria-label="Which assistant named the venue, by question"
          style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  borderBottom: '1px solid var(--border)',
                  width: '46%',
                }}
              >
                Question
              </th>
              {assistants.map(assistant => (
                <th
                  key={assistant.key}
                  style={{
                    padding: '14px 10px',
                    borderBottom: '1px solid var(--border)',
                    verticalAlign: 'bottom',
                  }}
                >
                  <Tooltip
                    title={assistant.label}
                    content={
                      assistant.grounded
                        ? 'Answers with live web results. The only assistant here that does, and the only one that reliably named the venue.'
                        : 'Answers from trained knowledge, with no live web lookup. This is where invented restaurants came from.'
                    }
                    align="right"
                    width="260px"
                  >
                    <span
                      style={{
                        display: 'block',
                        fontSize: 11,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        color: 'var(--fg2)',
                        cursor: 'help',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {assistant.label.split('(')[0].trim()}
                      {assistant.grounded && (
                        <span style={{ color: 'var(--brand-teal)', marginLeft: 5, letterSpacing: 0 }}>●</span>
                      )}
                    </span>
                  </Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.questionId}>
                <td
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--fg)',
                    fontSize: 13.5,
                    lineHeight: 1.35,
                  }}
                >
                  <span>{row.text}</span>
                  {row.intent && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginLeft: 8,
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--muted)',
                        border: '1px solid var(--border)',
                        borderRadius: 999,
                        padding: '1px 7px',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.intent}
                    </span>
                  )}
                </td>
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={assistants[cellIndex]?.key ?? cellIndex}
                    className={cell.answer ? 'mx-cell' : undefined}
                    data-open={cell.answer ? 'true' : undefined}
                    style={cellStyle(cell)}
                    role={cell.answer ? 'button' : undefined}
                    tabIndex={cell.answer ? 0 : undefined}
                    onKeyDown={event => {
                      if (!cell.answer) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onOpen(rowIndex * assistants.length + cellIndex)
                      }
                    }}
                    onClick={() => cell.answer && onOpen(rowIndex * assistants.length + cellIndex)}
                    title={cell.answer ? CELL_COPY[cell.kind].title + ' — click to read the answer' : CELL_COPY[cell.kind].title}
                  >
                    {cell.kind === 'ranked' ? `#${cell.position}` : CELL_COPY[cell.kind].label}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
