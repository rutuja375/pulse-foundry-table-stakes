'use client'

/**
 * The start screen, modelled on the Weiss landing page.
 *
 * What we took from it, precisely: the composer is not a box, it is a hairline
 * under the text, sitting inline beneath the headline and left-aligned to the
 * column — the page has no filled surface except the send arrow. Chips sit 12px
 * under the rule. Everything else is quiet.
 *
 * What we changed: their composer takes a chat message, ours takes a restaurant
 * and a place, because that is what the audit needs. One line, parsed, with the
 * parse shown back so nobody has to guess what we understood.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Plus } from 'lucide-react'

const EXAMPLES = [
  'Café Athena, Pacific Beach, San Diego',
  "Joe's Pizza, Greenwich Village, New York",
  'Pizzeria Bianco, Phoenix',
]

export function StartComposer() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const parsed = (() => {
    const parts = value.split(',').map(part => part.trim()).filter(Boolean)
    if (!parts.length) return { name: '', place: '' }
    return { name: parts[0], place: parts.slice(1).join(', ') }
  })()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!parsed.name) {
      setError('Start with the restaurant name.')
      inputRef.current?.focus()
      return
    }
    if (!parsed.place) {
      setError('Add the city or neighbourhood after a comma — the questions have to be local.')
      inputRef.current?.focus()
      return
    }
    setError(null)
    router.push(`/confirm?venue=${encodeURIComponent(parsed.name)}&place=${encodeURIComponent(parsed.place)}`)
  }

  return (
    <div className="landing">
      <div className="landing-main">
        <div className="landing-label">AI visibility audit</div>
        <h1 className="landing-title">
          Ask the questions
          <br />
          your customers ask.
        </h1>
        <p className="landing-body">
          Five assistants answer twenty local questions — cuisine, dietary, occasion, distance. We record what
          they say, verbatim, and count who they name instead of you.
        </p>

        <form onSubmit={submit} className="composer-form">
          <div className="composer">
            <button
              type="button"
              className="composer-icon"
              aria-label="Fill in an example"
              title="Fill in an example"
              onClick={() => {
                const next = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]
                setValue(next)
                setError(null)
                inputRef.current?.focus()
              }}
            >
              <Plus size={20} strokeWidth={1.6} />
            </button>

            <input
              ref={inputRef}
              className="composer-input"
              value={value}
              onChange={event => {
                setValue(event.target.value)
                if (error) setError(null)
              }}
              placeholder="Café Athena, Pacific Beach, San Diego"
              aria-label="Restaurant name, then city or neighbourhood"
              autoComplete="off"
              spellCheck={false}
            />

            <button type="submit" className="composer-send" aria-label="Continue">
              <ArrowRight size={18} strokeWidth={1.6} />
            </button>
          </div>

          {/* The parse, shown back. A reader should never have to guess what we understood. */}
          <div className="composer-parse">
            {parsed.name ? (
              <>
                <span className="parse-chip">
                  <span className="parse-key">restaurant</span>
                  {parsed.name}
                </span>
                {parsed.place && (
                  <span className="parse-chip">
                    <span className="parse-key">place</span>
                    {parsed.place}
                  </span>
                )}
              </>
            ) : (
              <span className="composer-hint">Name first, then the city, separated by commas.</span>
            )}
          </div>

          {error && <p className="composer-error">{error}</p>}

          <div className="chips">
            {EXAMPLES.map(example => (
              <button
                key={example}
                type="button"
                className="chip-btn"
                onClick={() => {
                  setValue(example)
                  setError(null)
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </form>
      </div>

      <aside className="landing-side">
        <div className="side-label">What happens next</div>

        <ol className="side-steps">
          <li>
            <span className="step-n">1</span>
            <div>
              <b>We confirm your website</b>
              <p>A guessed address, checked against the live page. You approve it or change it.</p>
            </div>
          </li>
          <li>
            <span className="step-n">2</span>
            <div>
              <b>Five assistants, twenty questions</b>
              <p>One call per question, answered in their own words. About two minutes.</p>
            </div>
          </li>
          <li>
            <span className="step-n">3</span>
            <div>
              <b>You get the report</b>
              <p>Every answer verbatim, every number counted from them.</p>
            </div>
          </li>
        </ol>

        <div className="side-block">
          <div className="side-label">Assistants</div>
          <div className="assistant-chips">
            {['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'DeepSeek'].map(name => (
              <span key={name} className="assistant-chip">
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="side-note">
          Competitors are not a field. The audit finds who gets named instead of you — typing them in would only
          tell us who you already worry about.
        </div>
      </aside>
    </div>
  )
}
