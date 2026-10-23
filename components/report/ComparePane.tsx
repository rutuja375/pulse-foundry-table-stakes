/**
 * Compare pane — you versus one named rival.
 *
 * Everything on this page is counted from the answers in the run: which
 * questions name each of you, in what order, and how much the two of you
 * overlap. The one block it cannot fill yet is "why", because that needs the
 * audit's evidence rows with an impact flag — and a display that guesses which
 * difference matters sends a restaurant to fix something that was never broken.
 */

import Link from 'next/link'
import type { IngestedReport } from '@/lib/view/ingest'
import { headToHead, type QuestionComparison } from '@/lib/view/compare'
import { formatRate } from '@/lib/view/derive'

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function position(value: number | null): string {
  return value === null ? 'absent' : `#${value}`
}

function QuestionLine({ row, tone }: { row: QuestionComparison; tone: 'win' | 'loss' }) {
  return (
    <div className="q-line">
      <span className="q-text">{row.text}</span>
      <span className={tone === 'win' ? 'q-pos q-pos-you' : 'q-pos q-pos-them'}>
        {tone === 'win' ? position(row.yourPosition) : position(row.theirPosition)}
      </span>
      <span className="q-pos q-pos-mute">{tone === 'win' ? `they ${position(row.theirPosition)}` : `you ${position(row.yourPosition)}`}</span>
    </div>
  )
}

export function ComparePane({ report, rival, slug }: { report: IngestedReport; rival: string; slug: string }) {
  const h2h = headToHead(report, rival)
  const completed = report.answers.filter(a => !a.error)
  // Answer-level counts, matching the rail and the competitor table.
  const yours = h2h.totals.yourMentions
  const theirs = h2h.totals.rivalMentions

  const overlapPct = formatRate(h2h.overlap)
  const bothCount = h2h.totals.both
  const questionCount = Math.max(1, h2h.totals.questions)

  /**
   * The sentence has to be generated from the counts, never asserted. "Parallel"
   * is the finding that stops an owner chasing the wrong name — but it is only
   * said when the overlap is genuinely low, and it may not call the counts a
   * dead heat unless they are one: 11 · 7 beside "you both appear 7 times"
   * contradicts the stat row directly above it.
   */
  const closeCounts = Math.min(yours, theirs) > 0 && Math.min(yours, theirs) >= Math.max(yours, theirs) * 0.8
  const onlyThem = h2h.totals.onlyThem
  const counts =
    yours === theirs ? `You are each named ${yours} times` : `You are named ${yours} times and they ${theirs}`
  const bothLower =
    bothCount === 0
      ? 'no question names you both'
      : bothCount === 1
        ? `only 1 of ${questionCount} questions names you both`
        : `only ${bothCount} of ${questionCount} questions name you both`
  const bothUpper = `${bothLower[0].toUpperCase()}${bothLower.slice(1)}`

  const posture =
    h2h.posture === 'parallel'
      ? closeCounts
        ? `${counts} — ${yours === theirs ? 'a dead heat on the count alone' : 'close enough to read as a dead heat'}. ${bothUpper}, so you are being recommended for different reasons rather than competing for the same customers.`
        : onlyThem > 0
          ? `${counts}, but ${bothLower}. Most of their count comes from questions you are not in at all, so this is two different jobs rather than one contest.`
          : `${counts}, and ${bothLower}. They win no question without you — they simply appear less often.`
      : h2h.posture === 'you-lead'
        ? h2h.losses.length === 0
          ? `You are named on ${h2h.wins.length} of ${questionCount} questions and they win none of the ones you lose.`
          : `You come out ahead on ${h2h.wins.length} of ${questionCount} questions and behind on ${h2h.losses.length}. The exchange favours you.`
        : h2h.posture === 'they-lead'
          ? `They come out ahead on ${h2h.losses.length} of ${questionCount} questions and behind on ${h2h.wins.length}. This is the comparison worth acting on.`
          : `You are named on the same questions often enough that this is a straight contest: ${h2h.wins.length} to you, ${h2h.losses.length} to them.`

  return (
    <div className="pane">
      <header className="pane-head">
        <div className="head-row">
          <span className="eyebrow">Head to head</span>
          <Link href="/" className="back-link">
            ← Back to the report
          </Link>
        </div>
        <h1 className="venue-title" style={{ fontSize: 34 }}>
          {report.venue.name} <span className="vs">vs</span> {rival}
        </h1>
        <p className="pane-lede">{posture}</p>
      </header>

      <section className="stat-row">
        <div className="stat">
          <div className="stat-k">Answers naming both</div>
          <div className="stat-v">{bothCount}</div>
          <div className="stat-n">of {h2h.totals.questions}</div>
        </div>
        <div className="stat">
          <div className="stat-k">Mentions</div>
          <div className="stat-v">
            {yours} · {theirs}
          </div>
          <div className="stat-n">
            {yours === theirs ? 'identical counts' : yours > theirs ? `you lead by ${yours - theirs}` : `they lead by ${theirs - yours}`}
          </div>
        </div>
        <div className="stat">
          <div className="stat-k">Overlap</div>
          <div className="stat-v">{overlapPct}</div>
          <div className="stat-n">{h2h.posture === 'parallel' ? 'parallel, not contested' : h2h.posture}</div>
        </div>
      </section>

      <section className="cmp-cols">
        <div className="cmp-block cmp-win">
          <div className="cmp-block-head">
            <span>Where you win</span>
            <span className="cmp-count">{h2h.wins.length}</span>
          </div>
          {h2h.wins.length ? (
            h2h.wins.map(row => <QuestionLine key={row.id} row={row} tone="win" />)
          ) : (
            <div className="q-line q-empty">No question names you without them.</div>
          )}
        </div>
        <div className="cmp-block cmp-loss">
          <div className="cmp-block-head">
            <span>Where they win</span>
            <span className="cmp-count">{h2h.losses.length}</span>
          </div>
          {h2h.losses.length ? (
            h2h.losses.map(row => <QuestionLine key={row.id} row={row} tone="loss" />)
          ) : (
            <div className="q-line q-empty">They do not win a single question.</div>
          )}
        </div>
      </section>

      <section className="blk">
        <div className="section-head-row">
          <h2 className="section-title" style={{ fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            By intent
          </h2>
          <span className="section-note">same counts, different questions</span>
        </div>
        <div className="card-flat">
          <table className="plain-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Intent</th>
                <th style={{ textAlign: 'right' }}>Questions</th>
                <th style={{ textAlign: 'right' }}>You</th>
                <th style={{ textAlign: 'right' }}>Them</th>
              </tr>
            </thead>
            <tbody>
              {h2h.intents.map(row => (
                <tr key={row.intent}>
                  <td style={{ textAlign: 'left', color: 'var(--fg)' }}>{row.intent}</td>
                  <td style={{ textAlign: 'right' }}>{row.questions}</td>
                  <td style={{ textAlign: 'right', color: row.youWin ? 'var(--brand-teal)' : 'var(--muted)' }}>{row.youWin}</td>
                  <td style={{ textAlign: 'right', color: row.theyWin ? 'var(--negative)' : 'var(--muted)' }}>{row.theyWin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="blk">
        <div className="section-head-row">
          <h2 className="section-title" style={{ fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Why — and which differences don&apos;t matter
          </h2>
          <span className="section-note">waiting on the evidence block</span>
        </div>
        <div className="notes">
          <p>
            Review counts, dietary labels, FAQ pages, structured data and press mentions live in the audit&apos;s
            evidence block. This page shows them only once each row carries an <b>explains</b>, <b>context</b> or{' '}
            <b>unknown</b> flag — without it, the display would be guessing which difference matters.
          </p>
          <p className="notes-foot">
            What is already certain from the answers: {plural(h2h.totals.onlyYou, 'question')} name you without them,{' '}
            {plural(h2h.totals.onlyThem, 'question')} name them without you, and {bothCount} name you both. Nothing on
            this page is inferred beyond those counts.
          </p>
        </div>
      </section>

      <section className="cta">
        <div>
          <div className="cta-title">
            {h2h.losses.length} question{h2h.losses.length === 1 ? '' : 's'} lost to this restaurant
          </div>
          <div className="cta-sub">
            The fix list opens with this comparison attached, so it arrives scoped to the questions you actually lose.
          </div>
        </div>
        <Link href={`/solutions?rival=${slug}`} className="btn btn--primary btn-link">
          Show me how to win {h2h.losses.length === 1 ? 'this question' : `these ${h2h.losses.length}`} →
        </Link>
      </section>
    </div>
  )
}
