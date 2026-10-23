'use client'

/**
 * Confirmation step.
 *
 * The website is a guess, so the screen is built around showing the evidence for
 * that guess: the fetched page's own title and description, the domain we tried,
 * and why we tried it. Approve in one click, or replace it with the real address.
 *
 * Candidates are checked one at a time and report as they go — a row that says
 * "checking cafeathenasd.com…" is more honest than a spinner over the whole list.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, Globe, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { candidateDomains } from '@/lib/site/candidates'
import type { SiteCandidate } from '@/lib/site/lookup'

type Row = {
  domain: string
  reason: string
  status: 'queued' | 'checking' | 'ok' | 'no'
  result?: SiteCandidate
}

export function ConfirmSite({ venue, place }: { venue: string; place: string }) {
  const router = useRouter()
  const [name, setName] = useState(venue)
  const [where, setWhere] = useState(place)
  const [rows, setRows] = useState<Row[]>(() =>
    candidateDomains(venue, place).map(guess => ({ ...guess, status: 'queued' as const }))
  )
  const [chosen, setChosen] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [manualNote, setManualNote] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Walk the guesses in order, stopping at the first page that looks like a venue.
  useEffect(() => {
    let cancelled = false

    async function run() {
      for (let index = 0; index < rows.length; index += 1) {
        if (cancelled) return
        if (chosen) return

        setRows(current => current.map((row, i) => (i === index ? { ...row, status: 'checking' } : row)))
        try {
          const response = await fetch(
            `/api/site-check?domain=${encodeURIComponent(rows[index].domain)}&reason=${encodeURIComponent(rows[index].reason)}&name=${encodeURIComponent(venue)}`
          )
          const result = (await response.json()) as SiteCandidate
          if (cancelled) return
          setRows(current =>
            current.map((row, i) => (i === index ? { ...row, status: result.ok ? 'ok' : 'no', result } : row))
          )
          if (result.ok) {
            setChosen(result.domain)
            return
          }
        } catch {
          if (cancelled) return
          setRows(current => current.map((row, i) => (i === index ? { ...row, status: 'no' } : row)))
        }
      }
      if (!cancelled) setDone(true)
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chosenRow = useMemo(() => rows.find(row => row.domain === chosen), [rows, chosen])
  const stillChecking = rows.some(row => row.status === 'checking' || row.status === 'queued')
  const website = chosenRow?.result?.url ?? (manual.trim() ? normaliseUrl(manual) : '')

  function start() {
    const params = new URLSearchParams({ venue: name.trim() || venue, place: where.trim() || place })
    if (website) params.set('website', website)
    router.push(`/run?${params.toString()}`)
  }

  /** Check one row on demand — the guesses we skipped when a better one matched. */
  async function checkRow(domain: string, reason: string) {
    setRows(current => current.map(row => (row.domain === domain ? { ...row, status: 'checking' } : row)))
    try {
      const response = await fetch(
        `/api/site-check?domain=${encodeURIComponent(domain)}&reason=${encodeURIComponent(reason)}&name=${encodeURIComponent(venue)}`
      )
      const result = (await response.json()) as SiteCandidate
      setRows(current => current.map(row => (row.domain === domain ? { ...row, status: result.ok ? 'ok' : 'no', result } : row)))
      if (result.ok) setChosen(domain)
    } catch {
      setRows(current => current.map(row => (row.domain === domain ? { ...row, status: 'no' } : row)))
    }
  }

  function applyManual() {
    const clean = manual
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(clean)) {
      setManualNote('That does not look like a domain. Try example.com')
      return
    }
    setManualNote(null)
    setChosen(null)
    setRows(current => [
      { domain: clean, reason: 'you pasted it', status: 'checking' },
      ...current,
    ])
    void fetch(`/api/site-check?domain=${encodeURIComponent(clean)}&reason=you+pasted+it&name=${encodeURIComponent(venue)}`)
      .then(response => response.json())
      .then((result: SiteCandidate) => {
        setRows(current =>
          current.map(row =>
            row.domain === clean ? { ...row, status: result.ok ? 'ok' : 'no', result } : row
          )
        )
        if (result.ok) setChosen(result.domain)
        else setManualNote('We could not load that page. You can still continue — the report will say no site evidence was collected.')
      })
      .catch(() => setManualNote('We could not load that page. You can still continue.'))
  }

  return (
    <div className="pane">
      <header className="pane-head">
        <div className="head-row">
          <span className="eyebrow">Step 2 of 3 · confirm the basics</span>
          <Link href="/new" className="back-link">
            ← Edit the details
          </Link>
        </div>
        <h1 className="venue-title" style={{ fontSize: 34 }}>
          Is this you?
        </h1>
        <p className="pane-lede">
          You are auditing <b>{venue}</b> in <b>{place}</b>. Approve the website below — the evidence table is built
          from whatever page we collect.
        </p>
      </header>

      <section className="blk">
        <div className="field-row">
          <label className="field">
            <span className="field-label">Restaurant</span>
            <input className="field-input" value={name} onChange={event => setName(event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Neighbourhood or city</span>
            <input className="field-input" value={where} onChange={event => setWhere(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="blk">
        <div className="section-head-row">
          <h2 className="section-title" style={{ fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Website
          </h2>
          <span className="section-note">
            {chosen ? 'confirmed' : stillChecking ? 'checking candidates…' : 'no match found'}
          </span>
        </div>

        <div className="data-card">
          <div className="data-card-head">
            <span className="data-card-title">Possible matches</span>
            <span className="data-card-meta">guessed from the name, checked against the live page</span>
          </div>

          <div className="site-rows">
            {rows.map(row => {
              const result = row.result
              const isChosen = chosen === row.domain
              return (
                <div key={row.domain} className={`site-row ${isChosen ? 'site-row-on' : ''}`}>
                  <div className="site-row-main">
                    <span className={`site-status site-${row.status}`}>
                      {row.status === 'checking' ? (
                        <Loader2 size={13} className="spin" />
                      ) : row.status === 'ok' ? (
                        <Check size={13} />
                      ) : (
                        <span className="site-dot" />
                      )}
                    </span>
                    <div className="site-row-text">
                      <span className="site-domain">{row.domain}</span>
                      <span className="site-reason">
                        {row.status === 'checking'
                          ? 'checking…'
                          : row.status === 'queued'
                            ? `${row.reason} · not checked`
                            : result?.ok
                              ? 'found — this looks like the restaurant'
                              : result?.error ?? 'no page here'}
                      </span>
                    </div>
                    {result?.ok ? (
                      <button
                        type="button"
                        className={isChosen ? 'btn btn-link btn--primary btn-sm' : 'btn btn-link btn--secondary btn-sm'}
                        onClick={() => setChosen(row.domain)}
                      >
                        {isChosen ? 'Using this' : 'Use this'}
                      </button>
                    ) : row.status === 'queued' ? (
                      <button type="button" className="link-btn" onClick={() => void checkRow(row.domain, row.reason)}>
                        Check
                      </button>
                    ) : null}
                  </div>

                  {isChosen && result && (
                    <div className="site-preview">
                      <div className="site-preview-head">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="site-favicon"
                          src={`https://www.google.com/s2/favicons?domain=${result.domain}&sz=64`}
                          alt=""
                          width={20}
                          height={20}
                        />
                        <div>
                          <div className="site-preview-title">{result.title ?? result.domain}</div>
                          <div className="site-preview-url">{result.finalUrl ?? result.url}</div>
                        </div>
                        <a
                          className="site-open"
                          href={result.finalUrl ?? result.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          open <ExternalLink size={12} />
                        </a>
                      </div>
                      {result.description && <p className="site-preview-desc">{result.description}</p>}
                      <p className="site-preview-note">
                        This is the page as it describes itself. Approve it and the audit collects evidence from
                        here.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="site-manual">
            <Globe size={14} strokeWidth={1.6} />
            <input
              className="site-manual-input"
              value={manual}
              placeholder="Not it? Paste the address, e.g. yoursite.com"
              onChange={event => setManual(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  applyManual()
                }
              }}
            />
            <button type="button" className="link-btn" onClick={applyManual}>
              Check it
            </button>
          </div>

          {manualNote && <p className="site-note">{manualNote}</p>}

          {done && !chosen && (
            <p className="site-note" style={{ paddingBottom: 14 }}>
              No guessed address resolved to a restaurant page. Paste the real one above, or continue without a
              site — the report will say plainly that no site evidence was collected.
            </p>
          )}
        </div>
      </section>

      <section className="cta">
        <div>
          <div className="cta-title">
            Next: {5} assistants, {20} questions
          </div>
          <div className="cta-sub">
            {website ? `Evidence from ${chosenRow?.domain ?? 'your site'}. ` : 'No site confirmed. '}
            Competitors are discovered by the audit, not typed in.
          </div>
        </div>
        <div className="cta-actions">
          <Link href="/new" className="btn btn-link btn--secondary">
            Back
          </Link>
          <Button variant="primary" onClick={start}>
            Start the audit
          </Button>
        </div>
      </section>
    </div>
  )
}

function normaliseUrl(value: string): string {
  const clean = value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  return `https://${clean}`
}
