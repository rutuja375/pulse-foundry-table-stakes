/**
 * Domain guesses — pure, so both the server lookup and the client progress list
 * agree on what is being checked, in what order, and why.
 *
 * The reasons matter: the confirmation screen shows "the name plus the city" and
 * lets a reader judge the guess, rather than presenting a domain as fact.
 */

export interface DomainGuess {
  domain: string
  reason: string
}

export function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function initials(value: string): string {
  return value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(word => word[0]?.toLowerCase() ?? '')
    .join('')
}

export function candidateDomains(name: string, place: string): DomainGuess[] {
  const nameSlug = slug(name)
  const city = (place.split(',')[0] ?? place).trim()
  const citySlug = slug(city)
  const cityInitials = initials(city)
  const out: DomainGuess[] = []

  const push = (domain: string, reason: string) => {
    if (domain.length > 4 && !out.some(entry => entry.domain === domain)) out.push({ domain, reason })
  }

  push(`${nameSlug}.com`, 'the name on its own')
  if (citySlug) push(`${nameSlug}${citySlug}.com`, 'the name plus the city')
  if (cityInitials) push(`${nameSlug}${cityInitials}.com`, 'the name plus the city initials')
  push(`${nameSlug}.restaurant`, 'the name on a restaurant domain')

  return out.slice(0, 4)
}
