'use client'

/**
 * Start screen.
 *
 * The reference is only a feel: generous type, no boxes, fields that are a rule
 * under the text, and one filled element on the page. The reader sets their own
 * details, because guessing a restaurant out of a sentence makes every question
 * downstream about the wrong restaurant.
 *
 * The details are remembered on this device, with the control visible: a reader
 * who comes back should not retype their restaurant, and a reader who is on a
 * shared machine should be able to turn that off in one click.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'
import { clearSavedVenue, readSavedVenue, saveVenue } from '@/lib/prefs'

export function StartDetails() {
  const router = useRouter()
  const nameRef = useRef<HTMLInputElement>(null)
  const placeRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [place, setPlace] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [remember, setRemember] = useState(true)
  const [restored, setRestored] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; place?: string }>({})

  // Restore once on mount. Nothing renders from storage during SSR, so the form
  // is identical on the server and on first paint, then fills in.
  useEffect(() => {
    const saved = readSavedVenue()
    if (!saved) return
    setName(current => current || saved.name)
    setPlace(current => current || saved.place)
    setCuisine(current => current || saved.cuisine)
    setRestored(Boolean(saved.name || saved.place))
  }, [])

  // Save as they type, debounced. Clearing storage on every keystroke would be
  // wasteful; leaving a stale entry when they blank the field would be wrong.
  useEffect(() => {
    if (!remember) return
    const timer = setTimeout(() => {
      if (!name.trim() && !place.trim()) return
      saveVenue({ name: name.trim(), place: place.trim(), cuisine: cuisine.trim(), site: readSavedVenue()?.site })
    }, 500)
    return () => clearTimeout(timer)
  }, [name, place, cuisine, remember])

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

    if (remember) saveVenue({ name: name.trim(), place: place.trim(), cuisine: cuisine.trim(), site: readSavedVenue()?.site })
    else clearSavedVenue()

    const params = new URLSearchParams({ venue: name.trim(), place: place.trim() })
    if (cuisine.trim()) params.set('cuisine', cuisine.trim())
    router.push(`/confirm?${params.toString()}`)
  }

  return (
    <form className="start" onSubmit={submit} noValidate>
      <div className="start-label">AI visibility audit</div>
      <h1 className="start-title">Start with your restaurant.</h1>

      {restored && (
        <div className="start-restored">
          <Check size={13} strokeWidth={2.2} />
          <span>Filled in from this device.</span>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              clearSavedVenue()
              setName('')
              setPlace('')
              setCuisine('')
              setRestored(false)
              nameRef.current?.focus()
            }}
          >
            Forget it
          </button>
        </div>
      )}

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

      <label className="start-remember">
        <input
          type="checkbox"
          checked={remember}
          onChange={event => {
            setRemember(event.target.checked)
            if (!event.target.checked) clearSavedVenue()
          }}
        />
        <span>
          Remember this restaurant on this device
          <em>Saved in this browser only — no account, nothing sent anywhere.</em>
        </span>
      </label>
    </form>
  )
}
