'use client'

/**
 * Start screen.
 *
 * Four fields, because four is what the audit needs to ask a sensible question:
 * who you are, where you are, how to find you, and who you lose to. The
 * assistant set is shown but not editable — it is a product decision, not a
 * setting.
 *
 * Until the backend exists, submitting opens the preflight screen. The form
 * says so plainly rather than implying a live run.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const ASSISTANTS = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'DeepSeek']

export function VenueForm() {
  const router = useRouter()
  const [venue, setVenue] = useState('')
  const [website, setWebsite] = useState('')
  const [place, setPlace] = useState('')
  const [rivals, setRivals] = useState('')
  const [questions, setQuestions] = useState('20')
  const [touched, setTouched] = useState(false)

  const venueError = touched && !venue.trim() ? 'A restaurant name is required — everything else is derived from it.' : null
  const placeError = touched && !place.trim() ? 'A neighbourhood or city is required, or the questions cannot be local.' : null

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!venue.trim() || !place.trim()) return
    const query = new URLSearchParams({ venue: venue.trim(), city: place.trim(), q: questions })
    if (website.trim()) query.set('website', website.trim())
    if (rivals.trim()) query.set('rivals', rivals.trim())
    router.push(`/run?${query.toString()}`)
  }

  return (
    <form className="form-card" onSubmit={submit} noValidate>
      <div className="form-head">
        <h2 className="form-title">Who are we auditing?</h2>
        <p className="form-sub">
          The questions are written from these fields, so the neighbourhood matters as much as the name.
        </p>
      </div>

      <div className="form-grid">
        <label className={`field ${venueError ? 'field-invalid' : ''}`}>
          <span className="field-label">Restaurant name</span>
          <input
            className="field-input"
            value={venue}
            onChange={event => setVenue(event.target.value)}
            placeholder="Café Athena"
            autoComplete="organization"
          />
          {venueError ? <span className="field-error">{venueError}</span> : <span className="field-hint">Exactly as customers see it.</span>}
        </label>

        <label className={`field ${placeError ? 'field-invalid' : ''}`}>
          <span className="field-label">Neighbourhood or city</span>
          <input
            className="field-input"
            value={place}
            onChange={event => setPlace(event.target.value)}
            placeholder="Pacific Beach, San Diego"
            autoComplete="address-level2"
          />
          {placeError ? <span className="field-error">{placeError}</span> : <span className="field-hint">Used to write local questions.</span>}
        </label>

        <label className="field">
          <span className="field-label">
            Website <span className="field-optional">optional</span>
          </span>
          <input
            className="field-input"
            value={website}
            onChange={event => setWebsite(event.target.value)}
            placeholder="cafeathenasd.com"
            inputMode="url"
          />
          <span className="field-hint">Where the evidence is collected from.</span>
        </label>

        <label className="field">
          <span className="field-label">
            Who do you lose to? <span className="field-optional">optional</span>
          </span>
          <input
            className="field-input"
            value={rivals}
            onChange={event => setRivals(event.target.value)}
            placeholder="Costa Brava, The Fishery"
          />
          <span className="field-hint">Comma separated. The audit finds the rest by itself.</span>
        </label>
      </div>

      <div className="form-assistants">
        <div className="field-label">Assistants measured</div>
        <div className="assistant-chips">
          {ASSISTANTS.map(name => (
            <span key={name} className="assistant-chip">
              {name}
            </span>
          ))}
        </div>
        <p className="form-note">
          One platform per assistant, without browsing history, memory or personalisation. The set is fixed — a
          comparison only means something if it is measured the same way every time.
        </p>
      </div>

      <div className="form-row">
        <label className="field field-inline">
          <span className="field-label">Questions</span>
          <select className="field-input field-select" value={questions} onChange={event => setQuestions(event.target.value)}>
            <option value="10">10 · quick check</option>
            <option value="20">20 · full audit</option>
          </select>
        </label>

        <div className="form-actions">
          <Link href="/" className="btn btn-link btn--quiet">
            Use the example instead
          </Link>
          <Button type="submit" variant="primary">
            Start the audit
          </Button>
        </div>
      </div>

      <p className="form-foot">
        <b>Not live yet.</b> The preflight screen replays the stored Café Athena run so the flow can be shown end to
        end. When the pipeline lands, this form posts to it and nothing else on the page changes.
      </p>
    </form>
  )
}
