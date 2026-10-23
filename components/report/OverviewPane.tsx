'use client'

/**
 * Overview pane — the report itself.
 *
 * Layout note: the rail now owns navigation, so the sticky section chips and
 * their scroll observer are gone. What is left is the document: the verdict,
 * four numbers, who can see you, every answer, and the reading notes. Sections
 * are numbered because the reading order matters, not because there is a nav to
 * jump between them.
 */

import { useMemo, useState } from 'react'
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

/** Backend answers arrive as the model's JSON reply, not prose. Show it as what it is. */
function RawJson({ text }: { text: string }) {
  let pretty = text
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    // Not valid JSON after all — print what arrived rather than pretending.
  }
  return (
    <div>
      <div className="answer-body-label">Raw model output</div>
      <pre className="raw-json">{pretty}</pre>
    </div>
  )
}

function AnswerBody({ text }: { text: string }) {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return <RawJson text={trimmed} />

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
      <span className="mono-label">{index}</span>
      <h2 className="section-title">{title}</h2>
      {note && <span className="section-note">{note}</span>}
    </div>
  )
}

export function OverviewPane({ report, initialAnswerKey }: { report: IngestedReport; initialAnswerKey?: string }) {
  const matrix = useMemo(() => buildMatrix(report), [report])
  const verdict = useMemo(() => headline(report), [report])
  const coverage = useMemo(() => intentCoverage(report), [report])

  const startIndex = useMemo(() => {
    if (!initialAnswerKey) return null
    const [questionId, modelKey] = initialAnswerKey.split(':')
    const row = matrix.rows.findIndex(r => r.questionId === questionId)
    const column = report.assistants.findIndex(a => a.key === modelKey)
    if (row < 0 || column < 0) return null
    return row * report.assistants.length + column
  }, [initialAnswerKey, matrix.rows, report.assistants])

  const [openIndex, setOpenIndex] = useState<number | null>(startIndex)

  const completed = report.answers.filter(a => !a.error)
  const named = completed.filter(a => a.mentioned).length
  const ranked = completed.filter(a => a.position !== null)
  const avgPosition = ranked.length ? ranked.reduce((s, a) => s + (a.position ?? 0), 0) / ranked.length : null

  const columns = report.assistants.length
  const opened = openIndex === null ? null : matrix.rows[Math.floor(openIndex / columns)]?.cells[openIndex % columns] ?? null
  const openedQuestion = openIndex === null ? null : matrix.rows[Math.floor(openIndex / columns)]

  const location = [report.venue.neighbourhood, report.venue.city].filter(Boolean).join(', ')

  return (
    <div className="pane">
      <header className="pane-head">
        <div className="head-row">
          <span className="eyebrow">
            AI visibility audit{location ? ` · ${location}` : ''}
          </span>
          <span className="eyebrow mono-label-soft">
            {formatDate(report.startedAt)} · run {report.runId}
          </span>
        </div>
        <h1 className="venue-title">{report.venue.name}</h1>
        <p className={verdict.invisible.length ? 'verdict verdict-bad' : 'verdict verdict-good'}>{verdict.sentence}</p>
        <p className="pane-lede">
          {report.totals.questions} questions asked of {report.totals.assistants} assistants, {formatDate(report.startedAt)}.
          Only the answers are shown, and every figure on this page is counted from them — verbatim text, one click
          behind each cell.
        </p>
      </header>

      <section className="blk">
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

      <section className="blk">
        <SectionHead index="01" title="Who can see you" note="hover a column heading for its definition" />
        <AssistantTable rows={report.assistants} />
      </section>

      <section className="blk">
        <SectionHead index="02" title="Every answer, by question" note="click any cell to read what was said" />
        <MatrixTable rows={matrix.rows} assistants={report.assistants} onOpen={setOpenIndex} />
        <div className="legend-row">
          <span>
            <span className="legend-rank">#3</span> ranked third
          </span>
          <span>named — no ranking given</span>
          <span className="legend-warn">declined — assistant refused to name any business</span>
          <span>— answered, named others</span>
          <span className="legend-bad">failed — excluded from every rate</span>
        </div>
      </section>

      <section className="blk">
        <SectionHead index="03" title="Who is named instead" note="open any restaurant in the rail to compare" />
        <CompetitorTable report={report} />
      </section>

      {coverage.length > 0 && (
        <section className="blk">
          <SectionHead index="04" title="By customer intent" note="where the gap is concentrated" />
          <div className="data-card">
            <div className="data-card-head">
              <span className="data-card-title">Intent coverage</span>
              <span className="data-card-meta">{coverage.length} intents · {coverage.reduce((s, r) => s + r.total, 0)} answers</span>
            </div>
            <table className="plain-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', width: '34%' }}>Intent</th>
                  <th style={{ textAlign: 'right' }}>Named</th>
                  <th style={{ textAlign: 'right', width: '38%' }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map(row => {
                  const rate = row.named / Math.max(1, row.total)
                  return (
                    <tr key={row.intent}>
                      <td style={{ textAlign: 'left', color: 'var(--fg)' }}>{row.intent}</td>
                      <td style={{ textAlign: 'right' }}>
                        {row.named} of {row.total}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', width: '100%' }}>
                          <span className="bar-track" style={{ width: 120 }}>
                            <span
                              className="bar-fill"
                              style={{
                                width: `${rate * 100}%`,
                                minWidth: row.named > 0 ? 6 : 0,
                                background: rate === 0 ? 'var(--negative)' : 'var(--active-accent)',
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

      <section>
        <SectionHead index="05" title="How this was read" note="assumptions the display had to make" />
        <div className="notes">
          {report.issues.length ? (
            <ul>
              {report.issues.map(issue => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p>Every field arrived where it was expected. No assumptions were needed.</p>
          )}
          <p className="notes-foot">
            Answers are measured on one platform per assistant, without browsing history, memory or personalisation.
            A mention is a mention in the answer text; a position is only recorded when the answer ranked the venue.
          </p>
        </div>
      </section>

      <Drawer
        open={Boolean(opened?.answer)}
        onClose={() => setOpenIndex(null)}
        title={opened?.answer?.modelLabel ?? ''}
        subtitle={openedQuestion?.text}
        width={620}
        footer={
          opened?.answer ? (
            <div className="drawer-foot">
              <span>
                {opened.kind === 'ranked'
                  ? `Ranked #${opened.position}`
                  : opened.kind === 'passing'
                    ? 'Named, not ranked'
                    : opened.kind === 'refused'
                      ? 'Declined to name any business'
                      : opened.kind === 'error'
                        ? `Failed: ${opened.answer.error}`
                        : 'Answered about other restaurants'}
              </span>
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
                The request failed ({opened.answer.error}). This cell is excluded from every rate rather than counted as
                a miss.
              </p>
            ) : (
              <AnswerBody text={opened.answer.answer || 'The payload held no answer text for this cell.'} />
            )}

            {opened.answer.names.length > 0 && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  What the answer named
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {opened.answer.names.map((entry, index) => (
                    <li key={`${entry.name}-${index}`} style={{ fontSize: 13, color: 'var(--fg2)' }}>
                      {entry.name}
                      <span className="named-basis">
                        {entry.basis === 'ranked' ? `#${entry.position}` : 'named in passing'}
                      </span>
                      {entry.reason && <span className="named-reason">{entry.reason}</span>}
                      {entry.sources && entry.sources.length > 0 && (
                        <span className="named-sources">
                          {entry.sources.map(source => (
                            <a key={source} href={source} target="_blank" rel="noreferrer noopener">
                              {source.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                            </a>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
