/**
 * Competitor canonicalisation, at display time.
 *
 * The backend dedupes by exact normalised name, so the same restaurant arrives
 * several ways and every leader is undercounted. Measured on one real run: 85
 * "competitors" for 43 answers, 47 of them named exactly once, and the top three
 * split across entries —
 *
 *   Spitz            14 + 3 + 1   = 18
 *   Slowly           15 + 2       = 17
 *   Shawarma Shack   12 + 3       = 15
 *   PB AleHouse       2 + 3       = 5   ("PB" vs "Pacific Beach")
 *
 * Merging belongs in their scoring, and that is where it should end up. Until
 * then the display does it, and says it did: the report's "How this was read"
 * lists the merges rather than silently rewriting the backend's numbers.
 *
 * The rule is deliberately narrow — merging two real restaurants into one is a
 * worse error than leaving a duplicate, because it invents a rival:
 *   1. drop parentheticals        "Pueblo (Pacific Beach)" → "pueblo"
 *   2. expand PB                   "pb alehouse" → "pacific beach alehouse"
 *   3. merge when one name is a token-prefix of the other
 *      "spitz" ⊂ "spitz pacific beach"        (single token allowed at 5+ chars)
 *      "mr shawarma" ⊄ "mr charlie's"          (2-char token, no merge)
 */

export interface CompetitorRow {
  name: string
  mentions: number
}

export interface MergeResult {
  rows: CompetitorRow[]
  /** Human-readable notes for the "How this was read" block. */
  notes: string[]
  mergedCount: number
}

const STOP = new Set(['the', 'a', 'of', 'and'])

/**
 * Words that describe a category rather than a restaurant. A bare "shawarma"
 * must not bridge "Shawarma Shack" and "Shawarma House" — those are two
 * businesses, and merging them invents a rival bigger than either.
 */
const GENERIC = new Set([
  'shawarma', 'kebab', 'kabob', 'pita', 'pizza', 'taco', 'burger', 'sushi', 'thai',
  'cafe', 'grill', 'bar', 'kitchen', 'restaurant', 'cantina', 'deli', 'bistro',
])

function canonicalKey(name: string): string[] {
  const withoutParens = name.replace(/\([^)]*\)/g, ' ')
  const normalised = withoutParens
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  const tokens = normalised.split(' ').filter(token => token && !STOP.has(token))
  // "PB" is the neighbourhood, not part of the name.
  return tokens.flatMap(token => (token === 'pb' ? ['pacific', 'beach'] : [token]))
}

function isPrefix(short: string[], long: string[]): boolean {
  if (short.length === 0 || short.length >= long.length) return false
  // A single token has to be distinctive on its own: "mr" is too short, and a
  // category word ("shawarma") describes several restaurants.
  if (short.length === 1 && (short[0].length < 5 || GENERIC.has(short[0]))) return false
  return short.every((token, index) => token === long[index])
}

export function mergeCompetitors(rows: CompetitorRow[]): MergeResult {
  const entries = rows.map(row => ({ row, key: canonicalKey(row.name), names: [row.name] }))

  // Union-find, not greedy assignment. A bare name ("Spitz") must be able to link
  // two longer variants ("Spitz Pacific Beach", "Spitz Mediterranean Street
  // Food") — greedy matching attached it to whichever came first and left the
  // variants separate.
  const parent = entries.map((_, index) => index)
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])))
  const union = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i].key
      const b = entries[j].key
      // Identical keys matter too: "PB AleHouse" and "Pacific Beach AleHouse"
      // expand to the same tokens, and isPrefix() is strictly shorter-than.
      if (a.join(' ') === b.join(' ') || isPrefix(a, b) || isPrefix(b, a)) union(i, j)
    }
  }

  const groups = new Map<number, { total: number; best: CompetitorRow; names: string[] }>()
  entries.forEach((entry, index) => {
    const root = find(index)
    const group = groups.get(root) ?? { total: 0, best: entry.row, names: [] }
    group.total += entry.row.mentions
    // Label the group with the most-mentioned spelling: it is what the models said.
    if (entry.row.mentions > group.best.mentions) group.best = entry.row
    group.names.push(entry.row.name)
    groups.set(root, group)
  })

  const merged = Array.from(groups.values())
    .map(group => ({
      name: group.best.name,
      mentions: group.total,
      aliases: group.names.length > 1 ? Array.from(new Set(group.names)) : undefined,
    }))
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name))

  const merges = merged.filter(row => row.aliases)
  const notes = merges
    .slice(0, 3)
    .map(
      row =>
        `"${row.name}" merges ${row.aliases!.length} spellings the audit counted separately (${row.aliases!.join(' · ')}).`
    )
  if (merges.length > 3) notes.push(`${merges.length - 3} more competitors were merged the same way.`)

  return {
    rows: merged.map(row => ({ name: row.name, mentions: row.mentions })),
    notes,
    mergedCount: merges.length,
  }
}
