'use client'

/**
 * The three hand-off editors: email, website change, code snippet.
 *
 * Each is a mock of where the change would land — a compose window, a browser
 * frame, a paste target — so the owner sees the destination, not a text box.
 * They are controlled: the drawer owns the draft and decides when it locks.
 * Nothing here sends, publishes or writes anywhere.
 */

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, Copy, Sparkles } from 'lucide-react'
import type { Handoff, Recipient } from '@/lib/view/solutions'

type Of<K extends Handoff['kind']> = Extract<Handoff, { kind: K }>

/** Square-bracket blanks the template or the model left for the owner. */
export function countBlanks(handoff: Handoff): number {
  const text =
    handoff.kind === 'email'
      ? `${handoff.subject}\n${handoff.body}`
      : handoff.kind === 'website'
        ? handoff.after
        : handoff.code
  return (text.match(/\[[^\]\n]{1,60}\]/g) ?? []).length
}

const frame: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--card-bg)',
  overflow: 'hidden',
}

const chrome: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: 'var(--surf-1)',
  borderBottom: '1px solid var(--border)',
  fontSize: 11.5,
  color: 'var(--muted)',
}

const label: CSSProperties = {
  fontSize: 10.5,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
}

const field: CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: 13,
  color: 'var(--fg)',
  padding: 0,
}

const area: CSSProperties = {
  ...field,
  resize: 'vertical',
  lineHeight: 1.6,
  fontSize: 13,
  minHeight: 220,
}

function Dots() {
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', gap: 5 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--surf-3)' }} />
      ))}
    </span>
  )
}

// ── Email ───────────────────────────────────────────────────────────────────

export function EmailDraft({
  value,
  onChange,
  locked,
  suggestedBy,
}: {
  value: Of<'email'>
  onChange: (next: Of<'email'>) => void
  locked: boolean
  suggestedBy: 'template' | 'model'
}) {
  const pick = (recipient: Recipient) => onChange({ ...value, to: recipient.email || recipient.label })
  const hasAddress = /\S+@\S+\.\S+/.test(value.to)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={frame}>
        <div style={chrome}>
          <Dots />
          <span style={{ marginLeft: 6 }}>New message</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', borderBottom: '1px solid var(--border)' }}>
          <label htmlFor="email-to" style={{ ...label, padding: '11px 14px' }}>To</label>
          <input
            id="email-to"
            value={value.to}
            onChange={e => onChange({ ...value, to: e.target.value })}
            readOnly={locked}
            placeholder="Pick a suggestion below or type an address"
            style={{ ...field, padding: '10px 14px 10px 0' }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', borderBottom: '1px solid var(--border)' }}>
          <label htmlFor="email-subject" style={{ ...label, padding: '11px 14px' }}>Subject</label>
          <input
            id="email-subject"
            value={value.subject}
            onChange={e => onChange({ ...value, subject: e.target.value })}
            readOnly={locked}
            style={{ ...field, padding: '10px 14px 10px 0', fontWeight: 600 }}
          />
        </div>
        <textarea
          aria-label="Email body"
          value={value.body}
          onChange={e => onChange({ ...value, body: e.target.value })}
          readOnly={locked}
          style={{ ...area, padding: '14px', display: 'block' }}
        />
      </div>

      {!locked && value.suggestions.length > 0 && (
        <div>
          <div style={{ ...label, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            {suggestedBy === 'model' && <Sparkles size={12} />}
            {suggestedBy === 'model' ? 'Suggested by AI (seeded) — check before sending' : 'Who to send it to'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {value.suggestions.map(recipient => {
              const active = value.to === (recipient.email || recipient.label)
              return (
                <button
                  key={recipient.label}
                  type="button"
                  onClick={() => pick(recipient)}
                  style={{
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'rgba(164, 55, 15, 0.06)' : 'var(--card-bg)',
                    color: 'var(--fg)',
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {recipient.label}
                  {recipient.email && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>{recipient.email}</span>}
                </button>
              )
            })}
          </div>
          {value.to && !hasAddress && (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--warning)' }}>
              No address yet — find it on the outlet’s contact page and paste it in.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Website change ──────────────────────────────────────────────────────────

export function WebsiteChange({
  value,
  onChange,
  locked,
  domain,
}: {
  value: Of<'website'>
  onChange: (next: Of<'website'>) => void
  locked: boolean
  domain: string
}) {
  return (
    <div style={frame}>
      <div style={chrome}>
        <Dots />
        <span
          style={{
            marginLeft: 6,
            flex: 1,
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '3px 10px',
            fontFamily: 'var(--font-data)',
            fontSize: 11,
            color: 'var(--fg2)',
          }}
        >
          {domain}{value.page.startsWith('/') ? value.page : ` ${value.page}`}
        </span>
      </div>

      {/*
        * "Today" is an observation, not a deletion. Striking it through said
        * "this is being removed" about copy that does not exist yet — the page
        * has no happy-hour section at all. The tag admits the one guess in it.
        */}
      <div className="doc-block">
        <div className="doc-block-head">
          <span className="doc-k">Today</span>
          <span className="doc-tag">assumed — site not crawled</span>
        </div>
        <p className="doc-observation">{value.before}</p>
      </div>

      <div className="doc-block doc-block-after">
        <div className="doc-block-head">
          <span className="doc-k doc-k-after">What to publish</span>
          <span className="doc-tag">editable · nothing published from here</span>
        </div>
        <textarea
          aria-label="New page copy"
          value={value.after}
          onChange={e => onChange({ ...value, after: e.target.value })}
          readOnly={locked}
          spellCheck={false}
          className="doc-copy"
          style={{ minHeight: 240 }}
        />
      </div>
    </div>
  )
}

// ── Code snippet ────────────────────────────────────────────────────────────

export function SnippetApply({
  value,
  onChange,
  locked,
}: {
  value: Of<'snippet'>
  onChange: (next: Of<'snippet'>) => void
  locked: boolean
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div style={frame}>
      <div style={{ ...chrome, justifyContent: 'space-between' }}>
        <span>{value.where}</span>
        <button
          type="button"
          onClick={copy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid var(--border)',
            background: 'var(--card-bg)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11.5,
            fontFamily: 'inherit',
            color: copied ? 'var(--brand-teal)' : 'var(--fg2)',
            cursor: 'pointer',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <textarea
        aria-label="Code snippet"
        value={value.code}
        onChange={e => onChange({ ...value, code: e.target.value })}
        readOnly={locked}
        spellCheck={false}
        style={{ ...area, fontFamily: 'var(--font-data)', fontSize: 12, padding: 14, minHeight: 280, display: 'block' }}
      />
    </div>
  )
}
