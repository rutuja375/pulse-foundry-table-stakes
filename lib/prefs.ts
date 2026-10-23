/**
 * Saved details, on this device.
 *
 * No account, no server: a draft in localStorage. That is a deliberate limit and
 * the UI says so ("saved on this device"), because a restaurant owner who thinks
 * they have an account and finds out they do not is worse off than one who knows
 * the save is local.
 *
 * Everything is wrapped: storage throws in private mode and can hold junk from an
 * older version of the app, and neither should break the start screen.
 */

const KEY = 'pf.venue.v1'

export interface SavedSite {
  domain: string
  url: string
  title: string | null
  description: string | null
  checkedAt: string
}

export interface SavedVenue {
  name: string
  place: string
  cuisine: string
  /** The website the reader approved last time, so we do not re-guess it. */
  site?: SavedSite
  savedAt: string
}

function storage(): Storage | null {
  try {
    const test = '__pf__'
    window.localStorage.setItem(test, test)
    window.localStorage.removeItem(test)
    return window.localStorage
  } catch {
    return null
  }
}

export function readSavedVenue(): SavedVenue | null {
  if (typeof window === 'undefined') return null
  const store = storage()
  if (!store) return null

  try {
    const raw = store.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedVenue>
    if (!parsed || typeof parsed !== 'object') return null
    const name = typeof parsed.name === 'string' ? parsed.name : ''
    const place = typeof parsed.place === 'string' ? parsed.place : ''
    if (!name.trim() && !place.trim()) return null

    return {
      name,
      place,
      cuisine: typeof parsed.cuisine === 'string' ? parsed.cuisine : '',
      site: parsed.site && typeof parsed.site === 'object' ? (parsed.site as SavedSite) : undefined,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    }
  } catch {
    // Corrupt entry: treat as nothing saved rather than crashing the form.
    return null
  }
}

export function saveVenue(next: Omit<SavedVenue, 'savedAt'>): void {
  const store = storage()
  if (!store) return
  const payload: SavedVenue = { ...next, savedAt: new Date().toISOString() }
  try {
    store.setItem(KEY, JSON.stringify(payload))
  } catch {
    // Quota or disabled storage: persistence is a convenience, not a requirement.
  }
}

export function saveSite(site: SavedSite): void {
  const current = readSavedVenue()
  if (!current) return
  saveVenue({ name: current.name, place: current.place, cuisine: current.cuisine, site })
}

export function clearSavedVenue(): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(KEY)
  } catch {
    // Nothing to do; the caller already cleared its own state.
  }
}
