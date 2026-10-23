/**
 * Website lookup — a guess, then a real check.
 *
 * We are not a crawler yet, so the flow is honest: derive candidate domains from
 * the name and the place, fetch each one, and show the page's own title and
 * description as evidence. "We think this is your site" is only defensible if
 * the reader can see what we found and change it in one click.
 *
 * Nothing here is asserted: every candidate carries `ok` and, when a fetch
 * fails, the reason. A wrong guess is expected; the confirmation step exists
 * because of it.
 */

export interface SiteCandidate {
  url: string
  domain: string
  ok: boolean
  title: string | null
  description: string | null
  /** Final URL after redirects — catches a guess that landed somewhere else. */
  finalUrl: string | null
  error: string | null
  /** Why this candidate was proposed, so the reader can judge the guess. */
  reason: string
}

import { candidateDomains } from './candidates'

export { candidateDomains }

const MAX_BYTES = 240_000

/**
 * Pages that answer 200 but are not the venue: bot challenges, parked domains,
 * login walls. The lookup refuses them rather than showing a reader a Cloudflare
 * interstitial and calling it their website.
 */
const BLOCK_PAGE = /attention required|just a moment|access denied|forbidden|are you a robot|enable javascript|domain (is )?for sale|parked|coming soon|under construction/i

/** Every word of the name worth matching: 3+ letters, normalised. */
function nameTokens(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 3)
}

/**
 * Does the page actually talk about this restaurant? A domain can resolve and
 * still be somebody else's site — accepting it would make every later evidence
 * row wrong, so the name has to appear in the title or description.
 */
function mentionsVenue(text: string, name: string): boolean {
  const haystack = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const tokens = nameTokens(name)
  if (!tokens.length) return false
  return tokens.every(token => haystack.includes(token))
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function metaContent(html: string, names: string[]): string | null {
  for (const name of names) {
    const pattern = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`,
      'i'
    )
    const match = html.match(pattern)
    if (match) return decodeEntities(match[1]).trim()
    const reversed = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`,
      'i'
    )
    const second = html.match(reversed)
    if (second) return decodeEntities(second[1]).trim()
  }
  return null
}

async function probe(domain: string, reason: string, name = ''): Promise<SiteCandidate> {
  const url = `https://${domain}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6500)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Some hosts serve an empty page to unknown agents.
        'user-agent': 'Mozilla/5.0 (compatible; PulseFoundryBot/0.1; +https://pulsefoundry.local)',
        accept: 'text/html',
      },
    })

    if (!response.ok) {
      return { url, domain, ok: false, title: null, description: null, finalUrl: response.url, error: `http ${response.status}`, reason }
    }

    const reader = response.body?.getReader()
    let html = ''
    if (reader) {
      const decoder = new TextDecoder()
      let received = 0
      while (received < MAX_BYTES) {
        const { done, value } = await reader.read()
        if (done) break
        received += value?.length ?? 0
        html += decoder.decode(value ?? new Uint8Array(), { stream: true })
      }
      await reader.cancel().catch(() => undefined)
    } else {
      html = await response.text()
    }

    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
    const description = metaContent(html, ['description', 'og:description'])
    const finalDomain = (() => {
      try {
        return new URL(response.url).hostname.replace(/^www\./, '')
      } catch {
        return domain
      }
    })()

    const cleanTitle = title ? decodeEntities(title).trim() : null
    const cleanDescription = description ? decodeEntities(description).slice(0, 240) : null

    // Three ways a 200 can still not be the venue: no page at all, a bot
    // challenge, or somebody else's restaurant.
    const blocked = Boolean(cleanTitle && BLOCK_PAGE.test(cleanTitle))
    const redirected = finalDomain !== domain
    const wrongVenue = Boolean(name) && !mentionsVenue(`${cleanTitle ?? ''} ${cleanDescription ?? ''}`, name)

    const problem = !cleanTitle
      ? 'no title on the page'
      : blocked
        ? 'the site blocks automated checks'
        : redirected
          ? `redirected to ${finalDomain}`
          : wrongVenue
            ? `the page does not mention ${name}`
            : null

    return {
      url,
      domain,
      ok: problem === null,
      title: cleanTitle ? cleanTitle.slice(0, 140) : null,
      description: cleanDescription,
      finalUrl: response.url,
      error: problem,
      reason,
    }
  } catch (error) {
    const message = error instanceof Error ? (error.name === 'AbortError' ? 'timed out' : error.message) : 'failed'
    return { url, domain, ok: false, title: null, description: null, finalUrl: null, error: message.slice(0, 80), reason }
  } finally {
    clearTimeout(timer)
  }
}

/**
 /** One domain, one fetch. The client walks the list so each row can report. */
 export async function checkDomain(domain: string, reason: string, name = ''): Promise<SiteCandidate> {
   return probe(domain, reason, name)
 }

 /**
  * Probes candidates in order and stops at the first plausible hit — the rest are
  * returned too, because "not this one?" needs somewhere to go.
  */
export async function lookupSite(name: string, place: string): Promise<{ candidates: SiteCandidate[]; best: SiteCandidate | null }> {
  const guesses = candidateDomains(name, place)
  const results: SiteCandidate[] = []

  for (const guess of guesses) {
    const result = await probe(guess.domain, guess.reason, name)
    results.push(result)
    if (result.ok) break
  }

  return { candidates: results, best: results.find(result => result.ok) ?? null }
}
