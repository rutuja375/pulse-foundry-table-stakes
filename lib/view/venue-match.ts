/**
 * Venue matching for the display layer.
 *
 * Deliberately duplicated from the engine rather than imported: this folder has
 * to travel into the team repo on its own, and a presentation layer that cannot
 * be read without the audit engine is not a presentation layer. Thirty lines of
 * normalisation is a cheaper dependency than an engine.
 *
 * It only ever answers one question — "is this name the venue?" — with the two
 * guards that earned their place against real data: asymmetric containment
 * ("Greek" must not match "Athena Greek") and a rival-suffix check ("Athena
 * Grill" is a different restaurant).
 */

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const RIVAL_SUFFIXES = new Set([
  'grill', 'taverna', 'kebab', 'kitchen', 'house', 'bar', 'cafe', 'bistro', 'pizza',
  'sushi', 'thai', 'deli', 'gyros', 'gyro', 'restaurant', 'cantina', 'bakery', 'lounge',
])

export function matchesVenue(candidate: string, aliases: string[]): boolean {
  const key = normalizeName(candidate)
  if (!key) return false
  const tokens = key.split(' ')

  return aliases.some(raw => {
    const alias = normalizeName(raw)
    if (!alias) return false
    if (!` ${key} `.includes(` ${alias} `)) return false
    if (alias.includes(' ')) return true
    const at = tokens.indexOf(alias)
    const next = tokens[at + 1]
    return !next || !RIVAL_SUFFIXES.has(next)
  })
}
