/**
 * Seeded "Rewrite with AI" drafts.
 *
 * A live model call per fix took too long for the demo, so the rewritten
 * drafts are written ahead of time for the stored run and replayed, keyed by
 * the template that produced the fix (dietary, happy-hour, …) — the same
 * arrangement as `lib/preflight/seed.ts`. The drawer says so: the label reads
 * "AI draft · seeded preview", never just "AI draft".
 *
 * When the audit starts returning drafts with its `actions[]`, one adapter
 * implements `RewriteSource` from the payload and this file goes away. Nothing
 * in the UI changes.
 *
 * Rules the seed follows, same as a live rewrite would:
 *   - facts the run does not contain stay as [square-bracket] blanks
 *   - recipient suggestions are real local outlets; addresses stay blank
 *     unless known — the owner finds and confirms them
 */

import type { Handoff } from '@/lib/view/solutions'
import { normalizeName } from '@/lib/view/venue-match'

export interface RewriteSource {
  /** Seeded drafts are labelled as such in the drawer. */
  seeded: boolean
  /** Rewritten hand-off for a fix's template, or null when there is none. */
  rewrite(template: string, current: Handoff): Handoff | null
}

/** Simulated latency, so the button reads as work rather than a swap. */
export const SEEDED_DELAY_MS = 1100

const CAFE_ATHENA: Record<string, Handoff> = {
  group: {
    kind: 'website',
    page: '/groups',
    before: 'No page. Group bookings handled by phone.',
    after: [
      'Groups & private dining at Café Athena',
      '',
      'Bringing a crowd to Pacific Beach? We seat parties of up to [N] in the main room and [N] in our private room — birthdays, team dinners, rehearsal dinners, the whole family in from out of town.',
      '',
      'Family-style Greek feast, from $[price] a head: [mezze to share], a choice of mains, and [dessert] to finish. [Vegetarian and gluten-free versions of every course.]',
      '',
      'Book by phone at [number] or email [address] — we confirm within one day. Ten minutes from Garnet Avenue, with [parking details].',
    ].join('\n'),
  },
  occasion: {
    kind: 'website',
    page: '/about',
    before: 'A short history of the restaurant. Nothing about the room, lighting or occasions.',
    after: [
      'Date night in Pacific Beach',
      '',
      'Café Athena is the [quiet] side of PB: [describe the room — lighting, tables, music], a Greek and Mediterranean [wine list], and a room where you can hear each other talk.',
      '',
      'Anniversaries, first dates, a proposal you have been planning for months — tell us when you book and we will hold [the corner table] and bring dessert on the house.',
      '',
      'Open for dinner [days] from [time]. Reservations at [link].',
    ].join('\n'),
  },
  'best-of-lists': {
    kind: 'email',
    to: '',
    subject: 'Café Athena — Greek in Pacific Beach, for your next round-up',
    body: [
      'Hi [name],',
      '',
      'I run Café Athena, a Greek restaurant in Pacific Beach. I read your recent piece on where to eat in PB and noticed Greek and Mediterranean were not on it — I would love to change that next time you update it.',
      '',
      'What our regulars come back for: [signature dish], a menu labelled for gluten-free and vegan diners, and a private room that seats [N] for groups.',
      '',
      'If you are ever in the neighbourhood, dinner is on us — no write-up expected.',
      '',
      'Best,',
      '[your name]',
      'Café Athena · [phone]',
    ].join('\n'),
    suggestions: [
      { label: 'San Diego Magazine — dining editor', email: '' },
      { label: 'Eater San Diego — tips line', email: '' },
      { label: 'San Diego Union-Tribune — food & dining', email: '' },
      { label: 'The Infatuation San Diego', email: '' },
    ],
  },
  location: {
    kind: 'website',
    page: '/ (title + about)',
    before: 'Title: Café Athena\nAbout: [street address only]',
    after: [
      'Title: Café Athena — Greek & Mediterranean in Pacific Beach, San Diego',
      '',
      'About: Café Athena sits in the heart of Pacific Beach, a short walk from Garnet Avenue and [landmark], and ten minutes from the boardwalk. [One line on why locals send visitors here.]',
    ].join('\n'),
  },
  dietary: {
    kind: 'website',
    page: '/menu',
    before: 'Dish names and prices only. Dietary options mentioned by staff, not on the page.',
    after: [
      'Gluten-free, vegan and vegetarian at Café Athena',
      '',
      'Every dish below is labelled. [How gluten-free orders are prepared.]',
      '',
      '[Salad] — vegan, gluten-free',
      '[Grilled dish] — gluten-free',
      '[Pastry] — vegetarian, contains dairy and gluten',
      '[Dish] — vegan, gluten-free on request',
      '',
      'Looking for gluten-free Mediterranean near Pacific Beach? Ask your server — we will walk you through the menu.',
    ].join('\n'),
  },
  'structured-data': {
    kind: 'snippet',
    where: 'Paste inside <head> on every page',
    code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Café Athena",
  "url": "https://cafeathena.com",
  "servesCuisine": ["Greek", "Mediterranean"],
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "[street]",
    "addressLocality": "San Diego",
    "addressRegion": "CA",
    "postalCode": "[zip]"
  },
  "areaServed": "Pacific Beach",
  "hasMenu": "https://cafeathena.com/menu",
  "acceptsReservations": true,
  "telephone": "[phone]"
}
</script>`,
  },
  'local-mentions': {
    kind: 'email',
    to: '',
    subject: 'A Pacific Beach Greek kitchen for your readers',
    body: [
      'Hi [name],',
      '',
      'Café Athena has been cooking Greek food in Pacific Beach for [years]. We would love to offer your readers [offer — e.g. 10% off with a student ID] and share the story behind the kitchen.',
      '',
      'Could I send a few photos and a short note?',
      '',
      'Thanks,',
      '[your name]',
    ].join('\n'),
    suggestions: [
      { label: 'Discover Pacific Beach — business district newsletter', email: '' },
      { label: 'The Daily Aztec (SDSU student paper)', email: '' },
      { label: 'Pacific Beach Town Council', email: '' },
    ],
  },
}

CAFE_ATHENA['happy-hour'] = {
  kind: 'website',
  page: '/happy-hour',
  before: 'No page. Happy hour shown on a board in the restaurant or an image post.',
  after: [
    'Happy hour on Garnet Ave',
    '',
    'Café Athena happy hour, [days] [start]–[end]: [offer — e.g. half-price mezze plates] and $[price] [Greek wines by the glass].',
    '',
    'Find us at [street address], a short walk from Garnet Avenue in Pacific Beach. Walk-ins welcome at the bar.',
  ].join('\n'),
}

CAFE_ATHENA.cuisine = {
  kind: 'website',
  page: '/menu',
  before: '[Dish] — $[price]',
  after: [
    'Greek and Mediterranean, cooked in Pacific Beach',
    '',
    '[Dish] — [main ingredient], [how it is cooked], served with [side]. $[price]',
    '[Dish] — [main ingredient], [how it is cooked], served with [side]. $[price]',
    '',
    'Every description says exactly what is in the dish, so you can order without asking.',
  ].join('\n'),
}

CAFE_ATHENA.reservations = {
  kind: 'website',
  page: '/reservations',
  before: 'Phone number in the footer. No mention of online booking.',
  after: [
    'Reservations at Café Athena',
    '',
    'Book a table online through [OpenTable / Resy / Yelp] at [link] — or call [number].',
    'We hold reservations for [N] minutes. Walk-ins are welcome at the bar, the easiest seat in Pacific Beach on a weeknight.',
    '',
    'Celebrating, or bringing [N] or more? See our groups page and we will set the table for you.',
  ].join('\n'),
}

CAFE_ATHENA.affordability = {
  kind: 'website',
  page: '/menu',
  before: 'Menu as a PDF download. No prices in the page text.',
  after: [
    'Greek lunch in Pacific Beach, most plates under $[price]',
    '',
    'Lunch: [gyro or pita plate] $[price] · [salad] $[price] · [lunch special] $[price]',
    'Dinner: mains $[price]–$[price]. Two people eat well for about $[price] before drinks.',
    '',
    'Prices are listed here in full — no PDF to download.',
  ].join('\n'),
}

CAFE_ATHENA.catering = {
  kind: 'website',
  page: '/catering',
  before: 'No page. Catering mentioned only if a customer asks.',
  after: [
    'Greek catering for San Diego offices and events',
    '',
    'Trays for [N] to [N] people: [mezze], [mains] and [salads], delivered to Pacific Beach and [areas], or ready for pickup.',
    'Every tray is labelled vegan, vegetarian or gluten-free, so a mixed office orders once.',
    'Order [N] days ahead at [email] or [phone]. Menu and per-person prices: [link].',
  ].join('\n'),
}

const SEEDS: Array<{ venue: string; drafts: Record<string, Handoff> }> = [{ venue: 'Café Athena', drafts: CAFE_ATHENA }]

/** Seeded drafts for this venue, if any were written. */
export function seededRewrites(venue: string): RewriteSource {
  const key = normalizeName(venue)
  const seed = SEEDS.find(s => normalizeName(s.venue) === key)
  return {
    seeded: true,
    rewrite(template, current) {
      const draft = seed?.drafts[template]
      if (!draft || draft.kind !== current.kind) return null
      // The owner's recipient is never overwritten by a rewrite.
      if (draft.kind === 'email' && current.kind === 'email') return { ...draft, to: current.to }
      return draft
    },
  }
}
