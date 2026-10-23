'use client'

/**
 * Start screen.
 *
 * The reference is only a feel: generous type, no boxes, fields that are a rule
 * under the text rather than a container around it, and exactly one filled
 * element on the page. Nothing is copied from it, and nothing is parsed.
 *
 * The reader sets their own details here — restaurant, place, cuisine — because
 * guessing a name out of a sentence is charming until it guesses wrong, and then
 * every question downstream is about the wrong restaurant.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

export function StartDetails() {
  const router = useRouter()
  const nameRef = useRef<HTMLInputElement>(null)
  const placeRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [place, setPlace] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [errors, setErrors] = useState<{ name?: string; place?: string }>({})

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors: { name?: string; place?: string } = {}
    if (!name.trim()) nextErrors.name = 'The restaurant name is how we check whether an assistant named it.'
    if (!place.trim()) nextErrors.place = 'The questions have to be local, so we need a city or neighbourhood.'

    setErrors(nextErrors)
    if (nextErrors.name) {
      nameRef.current?.focus()
      return
    }
    if (nextErrors.place) {
      placeRef.current?.focus()
      return
    }

    const params = new URLSearchParams({
      venue: name.trim(),
      place: place.trim(),
    })
    if (cuisine.trim()) params.set('cuisine', cuisine.trim())
    router.push(`/confirm?${params.toString()}`)
  }

  return (
    <form className="start" onSubmit={submit} noValidate>
      <div className="start-label">AI visibility audit</div>
      <h1 className="start-title">Start with your restaurant.</h1>

      <div className="start-fields">
        <label className={`start-field ${errors.name ? 'start-field-invalid' : ''}`}>
          <span className="start-field-label">Restaurant</span>
          <input
            ref={nameRef}
            className="start-input"
            value={name}
            onChange={event => {
              setName(event.target.value)
              if (errors.name) setErrors(current => ({ ...current, name: undefined }))
            }}
            placeholder="Café Athena"
            autoComplete="organization"
            autoFocus
          />
          <span className={errors.name ? 'start-field-error' : 'start-field-hint'}>
            {errors.name ?? 'Exactly as customers see it, accents included.'}
          </span>
        </label>

        <label className={`start-field ${errors.place ? 'start-field-invalid' : ''}`}>
          <span className="start-field-label">City or neighbourhood</span>
          <input
            ref={placeRef}
            className="start-input"
            value={place}
            onChange={event => {
              setPlace(event.target.value)
              if (errors.place) setErrors(current => ({ ...current, place: undefined }))
            }}
            placeholder="Pacific Beach, San Diego"
            autoComplete="address-level2"
          />
          <span className={errors.place ? 'start-field-error' : 'start-field-hint'}>
            {errors.place ?? 'Used to write the questions the way people nearby would ask them.'}
          </span>
        </label>

        <label className="start-field">
          <span className="start-field-label">
            Cuisine <span className="start-optional">optional</span>
          </span>
          <input
            className="start-input"
            value={cuisine}
            onChange={event => setCuisine(event.target.value)}
            placeholder="Greek, Mediterranean"
          />
          <span className="start-field-hint">Sharpens the cuisine questions. We can infer it if you skip it.</span>
        </label>
      </div>

      <div className="start-actions">
        <button type="submit" className="start-submit" aria-label="Continue to website confirmation">
          <span>Continue</span>
          <ArrowRight size={17} strokeWidth={1.7} />
        </button>
        <span className="start-next">Next: we find your website and you approve it.</span>
      </div>
    </form>
  )
}
