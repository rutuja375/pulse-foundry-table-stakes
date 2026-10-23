import type { IngestedReport } from './ingest'
import { intentCoverage } from './derive'
import { matchesVenue } from './venue-match'

/**
 * Recommended fixes.
 *
 * Every fix is triggered by a gap the run can show — an intent the venue lost,
 * a rival that keeps getting named — and carries that figure as its evidence.
 * A fix without a finding behind it does not get built here.
 *
 * Drafts are templates filled from the report. They are the floor, not the
 * ceiling: the drawer can ask the model to rewrite one, and if that fails the
 * template stays. Nothing in this file talks to a model or the network.
 *
 * Each fix carries exactly one hand-off — an email, a website change or a code
 * snippet. All three are mocked downstream: nothing is sent or published.
 *
 * This is the stand-in for the audit's `actions[]` (docs/report-payload.md).
 * Each fix carries the same `fixes: { intents, rivals }` target the contract
 * asks for, so the comparison filter works today and keeps working when the
 * audit's own list replaces this one.
 */

export type Priority = 'high' | 'medium' | 'low'
export type Level = 'High' | 'Medium' | 'Low'

export interface Recipient {
  /** Who this is, in words the owner recognises: "Food editor, local paper". */
  label: string
  /** Blank when unknown. Never guessed in the template; the model may suggest one. */
  email: string
}

export type Handoff =
  | { kind: 'email'; to: string; subject: string; body: string; suggestions: Recipient[] }
  | { kind: 'website'; page: string; before: string; after: string }
  | { kind: 'snippet'; where: string; code: string }

export type HandoffKind = Handoff['kind']

export interface Fix {
  id: string
  /** Which template produced the draft; seeded rewrites are keyed by it. */
  template: string
  title: string
  /** One or two sentences on why — the finding in plain words. */
  why: string
  /** The figure the fix answers, e.g. "0 of 5 group answers". */
  evidence: string
  /** A real question from the run that this fix is for. */
  example: string | null
  priority: Priority
  effort: string
  impact: Level
  /** Answers lost on this gap; used for ordering. */
  lost: number
  /** Same shape as the payload contract: which intents and rivals this wins back. */
  fixes: { intents: string[]; rivals: string[] }
  handoff: Handoff
}

interface IntentGap {
  intent: string
  total: number
  named: number
  example: string | null
  /** Most-named rival on this intent. */
  rival: string | null
  /** Every rival named on this intent, most-named first. */
  rivals: string[]
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
const MAX_FIXES = 6

function priorityFor(rate: number): Priority | null {
  if (rate === 0) return 'high'
  if (rate < 0.5) return 'medium'
  if (rate < 0.8) return 'low'
  return null
}

function impactFor(lost: number, total: number): Level {
  const share = lost / Math.max(1, total)
  if (share >= 0.6) return 'High'
  if (share >= 0.3) return 'Medium'
  return 'Low'
}

function slug(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
}

function isVenue(name: string, report: IngestedReport): boolean {
  return matchesVenue(name, [report.venue.name, ...report.venue.aliases])
}

/** Per intent: how many answers, how many named the venue, who was named instead. */
function intentGaps(report: IngestedReport): IntentGap[] {
  const intentOf = new Map(report.questions.map(q => [q.id, q.intent || 'untagged']))

  return intentCoverage(report).map(row => {
    const rivals = new Map<string, number>()
    for (const answer of report.answers) {
      if (answer.error || intentOf.get(answer.questionId) !== row.intent) continue
      for (const entry of answer.names) {
        if (isVenue(entry.name, report)) continue
        rivals.set(entry.name, (rivals.get(entry.name) ?? 0) + 1)
      }
    }
    const ranked = Array.from(rivals.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name)
    const example = report.questions.find(q => (q.intent || 'untagged') === row.intent)?.text ?? null
    return { ...row, example, rival: ranked[0] ?? null, rivals: ranked }
  })
}

// ── Templates per intent ────────────────────────────────────────────────────

interface Ctx {
  name: string
  area: string
  city: string
  cuisine: string
}

interface IntentTemplate {
  title: (ctx: Ctx, gap?: IntentGap) => string
  why: (ctx: Ctx, gap: IntentGap) => string
  effort: string
  handoff: (ctx: Ctx) => Handoff
}

function instead(gap: IntentGap): string {
  return gap.rival ? ` Assistants named ${gap.rival} instead.` : ''
}

const INTENT_TEMPLATES: Record<string, IntentTemplate> = {
  dietary: {
    title: () => 'Put dietary labels in the menu text',
    why: (ctx, gap) =>
      `Dietary questions ask for gluten-free, vegan or halal by name. If those words are not in readable text on your menu, assistants cannot match ${ctx.name} to them.${instead(gap)}`,
    effort: '30 min',
    handoff: ctx => ({
      kind: 'website',
      page: '/menu',
      before: 'Dish names and prices only. Dietary options mentioned by staff, not on the page.',
      after: [
        `Every dish at ${ctx.name} is labelled below. Ask your server and we will walk you through it.`,
        '',
        '[Dish] — vegan, gluten-free',
        '[Dish] — vegetarian, contains dairy',
        '[Dish] — gluten-free on request',
        '',
        `Gluten-free ${ctx.cuisine} in ${ctx.area}: we keep a separate prep surface for gluten-free orders.`,
      ].join('\n'),
    }),
  },
  group: {
    title: () => 'Give groups and private dining a page',
    why: (ctx, gap) =>
      `Group questions want capacity, a set menu and how to book. ${ctx.name} has no page that says any of it.${instead(gap)}`,
    effort: '1 hr',
    handoff: ctx => ({
      kind: 'website',
      page: '/groups',
      before: 'No page. Group bookings handled by phone.',
      after: [
        `Groups at ${ctx.name}`,
        '',
        `We seat parties of up to [N] in ${ctx.area}, with a shared ${ctx.cuisine} set menu from $[price] a head.`,
        'Private room for [N] guests — birthdays, team dinners, rehearsal dinners.',
        'Book by phone at [number] or email [address]. We confirm within one day.',
      ].join('\n'),
    }),
  },
  occasion: {
    title: () => 'Name the occasions you are good for',
    why: (ctx, gap) =>
      `Date-night and celebration questions are answered from pages that describe the room and the evening. ${ctx.name} does not describe either.${instead(gap)}`,
    effort: '45 min',
    handoff: ctx => ({
      kind: 'website',
      page: '/about',
      before: 'A short history of the restaurant. Nothing about the room, lighting or occasions.',
      after: [
        `Date night in ${ctx.area}`,
        '',
        `Candlelit tables, a ${ctx.cuisine} wine list and a quiet back room — ${ctx.name} is where ${ctx.area} goes for anniversaries and first dates.`,
        'Tell us it is a special occasion when you book and dessert is on us.',
      ].join('\n'),
    }),
  },
  location: {
    title: () => 'Say where you are in words',
    why: (ctx, gap) =>
      `Location questions name streets and landmarks. Your site gives an address but never says what is nearby, so walking-distance questions skip ${ctx.name}.${instead(gap)}`,
    effort: '20 min',
    handoff: ctx => ({
      kind: 'website',
      page: '/ (title + about)',
      before: `Title: ${ctx.name}\nAbout: [street address only]`,
      after: [
        `Title: ${ctx.name} — ${ctx.cuisine} in ${ctx.area}, ${ctx.city}`,
        '',
        `About: Find us in the heart of ${ctx.area}, a short walk from [landmark] and [landmark]. Five minutes from [street] — the spot locals send visitors to for ${ctx.cuisine}.`,
      ].join('\n'),
    }),
  },
  cuisine: {
    title: () => 'Describe the dishes, not just name them',
    why: (ctx, gap) =>
      `Best-${ctx.cuisine} questions are answered from menus that explain what is in each dish. One-line names give assistants nothing to quote.${instead(gap)}`,
    effort: '1 hr',
    handoff: ctx => ({
      kind: 'website',
      page: '/menu',
      before: '[Dish] — $[price]',
      after: [
        `[Dish] — slow-roasted [main ingredient], [side], finished with [detail]. The plate regulars in ${ctx.area} order first. $[price]`,
        '',
        `Our ${ctx.cuisine} kitchen cooks from family recipes; every description above says exactly what is in the dish.`,
      ].join('\n'),
    }),
  },
}

const HAPPY_HOUR_TEMPLATE: IntentTemplate = {
  title: () => 'Turn happy hour into a page',
  why: (ctx, gap) =>
    `Happy-hour questions want times, prices and a street name. If your offer only exists on a sign or an image, assistants cannot quote it.${instead(gap)}`,
  effort: '30 min',
  handoff: ctx => ({
    kind: 'website',
    page: '/happy-hour',
    before: 'No page. Happy hour shown on a board in the restaurant or an image post.',
    after: [
      `Happy hour at ${ctx.name}`,
      '',
      `[Days], [start]–[end]. [Offer — e.g. half-price mezze and $[price] house wine], in ${ctx.area}.`,
      '[Street] — a short walk from [landmark].',
    ].join('\n'),
  }),
}

/**
 * Intents arrive as free text from the audit ("happy hour", "mediterranean
 * food"), so templates are matched by keyword over the intent and the
 * questions asked under it. First match wins; order is most specific first.
 */
const TEMPLATE_KEYWORDS: Array<[key: string, pattern: RegExp]> = [
  ['dietary', /gluten|vegan|vegetarian|halal|kosher|dietary|allerg|dairy/i],
  ['happy-hour', /happy hour|drinks|cocktail/i],
  ['group', /group|party|private|large table|birthday/i],
  ['occasion', /date night|occasion|anniversary|romantic|celebrat/i],
  ['location', /\bnear\b|walk|location|\bave\b|street|close to|nearby/i],
  ['cuisine', /cuisine|food|best|restaurant/i],
]

function templateFor(intent: string, questionTexts: string[]): { key: string; template: IntentTemplate } {
  const haystack = [intent, ...questionTexts].join(' ')
  for (const [key, pattern] of TEMPLATE_KEYWORDS) {
    if (pattern.test(haystack)) return { key, template: key === 'happy-hour' ? HAPPY_HOUR_TEMPLATE : INTENT_TEMPLATES[key] }
  }
  return { key: 'generic', template: GENERIC_TEMPLATE }
}

const GENERIC_TEMPLATE: IntentTemplate = {
  title: (_ctx, gap) => `Answer the ${gap?.intent ?? ''} questions on your site`,
  why: (ctx, gap) =>
    `No page on ${ctx.name}'s site answers the ${gap.intent} questions directly, so assistants answer them with someone else.${instead(gap)}`,
  effort: '45 min',
  handoff: ctx => ({
    kind: 'website',
    page: '/faq',
    before: 'No FAQ page.',
    after: [`Questions about ${ctx.name}`, '', 'Q: [question from the run]', `A: [two-sentence answer that names ${ctx.area}]`].join('\n'),
  }),
}

// ── Fixes that are not tied to one intent ───────────────────────────────────

function schemaFix(ctx: Ctx, worstLost: number, total: number): Fix {
  const code = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: ctx.name,
      servesCuisine: ctx.cuisine,
      address: { '@type': 'PostalAddress', addressLocality: ctx.area, addressRegion: ctx.city },
      hasMenu: '/menu',
      acceptsReservations: true,
    },
    null,
    2
  )
  return {
    id: 'structured-data',
    template: 'structured-data',
    title: 'Describe the restaurant in structured data',
    why: 'Structured data states your cuisine, area and menu in a form search engines and assistants parse without guessing. It backs up every page change above.',
    evidence: `backs up the fixes for ${worstLost} of ${total} lost answers`,
    example: null,
    priority: 'medium',
    effort: '15 min',
    impact: 'Medium',
    // Supporting work: ordered after the fixes it backs up, not ahead of them.
    lost: 0,
    fixes: { intents: [], rivals: [] },
    handoff: {
      kind: 'snippet',
      where: 'Paste inside <head> on every page',
      code: `<script type="application/ld+json">\n${code}\n</script>`,
    },
  }
}

function listOutreachFix(ctx: Ctx, rival: { name: string; mentions: number }, named: number, total: number): Fix {
  return {
    id: 'best-of-lists',
    template: 'best-of-lists',
    title: `Get onto the ${ctx.area} best-of lists`,
    why: `${rival.name} is named in ${rival.mentions} answers. Assistants lean on local round-ups and "best of" lists, and ${ctx.name} is not on the ones they cite.`,
    evidence: `${rival.mentions} answers name ${rival.name} · ${named} name you`,
    example: null,
    priority: named === 0 ? 'high' : 'medium',
    effort: '20 min',
    impact: impactFor(total - named, total),
    lost: total - named,
    fixes: { intents: [], rivals: [rival.name] },
    handoff: {
      kind: 'email',
      to: '',
      subject: `${ctx.name} — for your next ${ctx.area} ${ctx.cuisine} round-up`,
      body: [
        'Hi [name],',
        '',
        `I run ${ctx.name}, a ${ctx.cuisine} restaurant in ${ctx.area}. I read your round-up of ${ctx.area} restaurants and would love to be considered next time you update it.`,
        '',
        'A few things readers ask us about: [signature dish], [dietary options], [group dining].',
        '',
        'Happy to host you for dinner, no strings attached.',
        '',
        'Best,',
        '[your name]',
        ctx.name,
      ].join('\n'),
      suggestions: [
        { label: `Food editor, ${ctx.city} city guide`, email: '' },
        { label: `Author of a "best ${ctx.cuisine} in ${ctx.area}" list`, email: '' },
      ],
    },
  }
}

function localOutreachFix(ctx: Ctx, named: number, total: number): Fix {
  return {
    id: 'local-mentions',
    template: 'local-mentions',
    title: 'Get mentioned by people nearby',
    why: `${ctx.name} is named in ${named} of ${total} answers. Neighbourhood blogs, student papers and community newsletters are cheap mentions that assistants pick up.`,
    evidence: `${named} of ${total} answers name you`,
    example: null,
    priority: 'low',
    effort: '20 min',
    impact: 'Low',
    lost: total - named,
    fixes: { intents: [], rivals: [] },
    handoff: {
      kind: 'email',
      to: '',
      subject: `A ${ctx.area} local favourite for your readers`,
      body: [
        'Hi [name],',
        '',
        `${ctx.name} has been cooking ${ctx.cuisine} in ${ctx.area} for [years]. We would love to offer your readers [offer — e.g. 10% off with a student ID] and tell the story behind the kitchen.`,
        '',
        'Could I send you a few photos and a short note?',
        '',
        'Thanks,',
        '[your name]',
      ].join('\n'),
      suggestions: [
        { label: `${ctx.area} neighbourhood blog`, email: '' },
        { label: 'Local student newspaper', email: '' },
        { label: `${ctx.area} business association newsletter`, email: '' },
      ],
    },
  }
}

// ── Entry point ─────────────────────────────────────────────────────────────

export function buildFixes(report: IngestedReport): Fix[] {
  const ctx: Ctx = {
    name: report.venue.name,
    area: report.venue.neighbourhood || report.venue.city || 'your area',
    city: report.venue.city || report.venue.neighbourhood || '',
    cuisine: report.venue.cuisine[0] || 'local',
  }

  const completed = report.answers.filter(a => !a.error)
  const total = completed.length
  if (!total) return []
  const named = completed.filter(a => a.mentioned).length

  const fixes: Fix[] = []
  let worstLost = 0

  for (const gap of intentGaps(report)) {
    const priority = priorityFor(gap.named / Math.max(1, gap.total))
    if (!priority) continue
    const lost = gap.total - gap.named
    worstLost += lost
    const questionTexts = report.questions.filter(q => (q.intent || 'untagged') === gap.intent).map(q => q.text)
    const { key, template } = templateFor(gap.intent, questionTexts)
    fixes.push({
      id: `intent-${slug(gap.intent)}`,
      template: key,
      title: template.title(ctx, gap),
      why: template.why(ctx, gap),
      evidence: `${gap.named} of ${gap.total} ${gap.intent} answers name you`,
      example: gap.example,
      priority,
      effort: template.effort,
      impact: impactFor(lost, gap.total),
      lost,
      fixes: { intents: [gap.intent], rivals: gap.rivals },
      handoff: template.handoff(ctx),
    })
  }

  const rival = report.competitors[0]
  if (rival && named / total < 0.5) fixes.push(listOutreachFix(ctx, rival, named, total))
  if (worstLost > 0) fixes.push(schemaFix(ctx, worstLost, total))
  if (named / total < 0.5) fixes.push(localOutreachFix(ctx, named, total))

  /*
   * One fix per template, not per intent.
   *
   * Two intents that need the same work ("greek food" and "mediterranean food"
   * both needing dietary labels) produced two identical cards with different
   * evidence — which reads as a bug to anyone holding the report, and inflates
   * the fix count. They merge into one card carrying both figures.
   */
  const merged = new Map<string, Fix>()
  for (const fix of fixes) {
    const existing = merged.get(fix.template)
    if (!existing) {
      merged.set(fix.template, fix)
      continue
    }
    // Two figures and a count. A card that lists five evidence strings in a row
    // reads as a dump; the reader needs the worst one and the sense of scale.
    const evidence = Array.from(
      new Set([...existing.evidence.split(' · '), ...fix.evidence.split(' · ')])
    )
    merged.set(fix.template, {
      ...existing,
      // Keep the more urgent priority and the larger body of lost questions.
      priority: PRIORITY_RANK[fix.priority] < PRIORITY_RANK[existing.priority] ? fix.priority : existing.priority,
      lost: existing.lost + fix.lost,
      evidence:
        evidence.length <= 2
          ? evidence.join(' · ')
          : `${evidence.slice(0, 2).join(' · ')} · ${evidence.length - 2} more intent${evidence.length - 2 === 1 ? '' : 's'}`,
      fixes: {
        intents: Array.from(new Set([...existing.fixes.intents, ...fix.fixes.intents])),
        rivals: Array.from(new Set([...existing.fixes.rivals, ...fix.fixes.rivals])),
      },
      example: existing.example ?? fix.example,
      impact: existing.impact === 'High' || fix.impact === 'High' ? 'High' : existing.impact,
    })
  }

  return Array.from(merged.values())
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.lost - a.lost)
    .slice(0, MAX_FIXES)
}

/** The fixes that win back questions lost to one rival. */
export function fixesForRival(fixes: Fix[], rival: string): Fix[] {
  return fixes.filter(fix => fix.fixes.rivals.includes(rival))
}
