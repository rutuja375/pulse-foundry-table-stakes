/**
 * Head-to-head comparison — you versus one named rival.
 *
 * Three questions get answered, and a fourth that the data cannot answer yet.
 *
 *   1. WHERE YOU WIN      questions where you are ranked and they are not, or
 *                         ranked ahead of them.
 *   2. WHERE THEY WIN     the mirror image. This is the part a restaurant owner
 *                         already suspects and wants to see spelled out.
 *   3. WHERE IT DOESN'T  questions where both of you appear and you come out
 *      MATTER            ahead anyway. A rival being named is not automatically
 *                         a loss, and saying so is what stops an owner chasing
 *                         a name that costs them nothing.
 *
 *   4. WHY               review counts, dietary labels, FAQ pages, schema,
 *                         press mentions: these live in the evidence block the
 *                         audit supplies. Until it arrives this module returns
 *                         nothing for them rather than inventing a reason.
 *
 * Everything here is counted from the answers. No model call, no heuristics
 * about "strength" — a position is a position.
 */

import type { IngestedReport } from './ingest'

export type Verdict = 'ahead' | 'behind' | 'only-you' | 'only-them' | 'neither' | 'both-unranked'

export interface QuestionComparison {
  id: string
  text: string
  intent: string
  yourPosition: number | null
  theirPosition: number | null
  youNamed: boolean
  theyNamed: boolean
  verdict: Verdict
  /** Answers where the call failed are excluded and counted separately. */
  excluded: boolean
}

export interface IntentComparison {
  intent: string
  questions: number
  youWin: number
  theyWin: number
  draws: number
}

export interface HeadToHead {
  rival: string
  totals: {
    questions: number
    both: number
    onlyYou: number
    onlyThem: number
    neither: number
    excluded: number
    /**
     * Answer-level mention counts, the same unit the rail and the competitor
     * table use. Keeping one unit matters: the first version of this pane showed
     * answers for the venue beside questions for the rival ("6 · 3") and the two
     * numbers looked comparable when they were not.
     */
    yourMentions: number
    rivalMentions: number
  }
  questions: QuestionComparison[]
  intents: IntentComparison[]
  /** Rows to show under "where you win", "where they win", "where it doesn't matter". */
  wins: QuestionComparison[]
  losses: QuestionComparison[]
  irrelevant: QuestionComparison[]
  /** True when the payload carried no evidence block, so "why" cannot be shown. */
  evidenceMissing: boolean
  /**
   * How much the two of you are actually fighting over the same questions.
   *
   * This is the antidote to the number an owner misreads: equal mention counts
   * look like a dead heat, but if you are named on different questions you are
   * parallel, not competing. `overlap` is the share of counted questions that
   * name both.
   */
  overlap: number
  posture: 'parallel' | 'contested' | 'you-lead' | 'they-lead'
}

export function headToHead(report: IngestedReport, rival: string): HeadToHead {
  const wanted = rival.trim().toLowerCase()
  const names = (answer: IngestedReport['answers'][number]): { named: boolean; position: number | null } => {
    const hit = answer.names.find(name => name.name.trim().toLowerCase() === wanted)
    if (!hit) return { named: false, position: null }
    return { named: true, position: hit.position }
  }

  const questions: QuestionComparison[] = report.questions.map(question => {
    const answers = report.answers.filter(a => a.questionId === question.id)
    const usable = answers.filter(a => !a.error)
    const excluded = usable.length === 0 && answers.length > 0

    // An assistant can name the same restaurant in different orders. The venue's
    // position is the best rank it received; the rival's is the best it received.
    // Comparing best-to-best keeps a single chatty answer from deciding the row.
    const yourPositions = usable.filter(a => a.mentioned).map(a => a.position).filter((p): p is number => p !== null)
    const theirPositions = usable.map(names).filter(n => n.named).map(n => n.position).filter((p): p is number => p !== null)

    const youNamed = usable.some(a => a.mentioned)
    const theyNamed = theirPositions.length > 0
    const yourPosition = yourPositions.length ? Math.min(...yourPositions) : null
    const theirPosition = theirPositions.length ? Math.min(...theirPositions) : null

    let verdict: Verdict = 'neither'
    if (excluded) verdict = 'neither'
    else if (youNamed && theyNamed) {
      if (yourPosition === null && theirPosition === null) verdict = 'both-unranked'
      else if (theirPosition === null) verdict = 'ahead'
      else if (yourPosition === null) verdict = 'behind'
      else verdict = yourPosition <= theirPosition ? 'ahead' : 'behind'
    } else if (youNamed) verdict = 'only-you'
    else if (theyNamed) verdict = 'only-them'

    return {
      id: question.id,
      text: question.text,
      intent: question.intent,
      yourPosition,
      theirPosition,
      youNamed,
      theyNamed,
      verdict,
      excluded,
    }
  })

  const counted = questions.filter(q => !q.excluded)
  const wins = counted.filter(q => q.verdict === 'only-you' || q.verdict === 'ahead')
  const losses = counted.filter(q => q.verdict === 'only-them' || q.verdict === 'behind')
  /**
   * "Doesn't matter" is deliberately narrow: both named, you ranked at least as
   * well. A question where you are behind is not irrelevant just because you
   * appear.
   */
  const irrelevant = counted.filter(q => q.youNamed && q.theyNamed && q.verdict === 'ahead')

  const intents = new Map<string, IntentComparison>()
  for (const row of counted) {
    const key = row.intent || 'untagged'
    const bucket = intents.get(key) ?? { intent: key, questions: 0, youWin: 0, theyWin: 0, draws: 0 }
    bucket.questions += 1
    if (wins.includes(row)) bucket.youWin += 1
    else if (losses.includes(row)) bucket.theyWin += 1
    else bucket.draws += 1
    intents.set(key, bucket)
  }

  const total = Math.max(1, counted.length)
  const both = counted.filter(q => q.youNamed && q.theyNamed).length
  const onlyYou = counted.filter(q => q.verdict === 'only-you').length
  const onlyThem = counted.filter(q => q.verdict === 'only-them').length
  const overlap = both / total

  /**
   * "Parallel" is the finding that stops an owner chasing the wrong name: each
   * of you is visible on a different set of questions, so the rival's count is
   * not evidence of losing those same customers.
   */
  const posture: HeadToHead['posture'] =
    overlap <= 0.25 && Math.abs(onlyYou - onlyThem) <= Math.max(1, Math.round(total * 0.34))
      ? 'parallel'
      : wins.length > losses.length
        ? 'you-lead'
        : losses.length > wins.length
          ? 'they-lead'
          : 'contested'

  const rivalMentions = report.answers.filter(
    a => !a.error && a.names.some(name => name.name.trim().toLowerCase() === wanted)
  ).length
  const yourMentions = report.answers.filter(a => !a.error && a.mentioned).length

  return {
    rival,
    totals: {
      yourMentions,
      rivalMentions,
      questions: counted.length,
      both: counted.filter(q => q.youNamed && q.theyNamed).length,
      onlyYou: counted.filter(q => q.verdict === 'only-you').length,
      onlyThem: counted.filter(q => q.verdict === 'only-them').length,
      neither: counted.filter(q => !q.youNamed && !q.theyNamed).length,
      excluded: questions.length - counted.length,
    },
    questions,
    intents: Array.from(intents.values()).sort((a, b) => b.theyWin - a.theyWin || b.questions - a.questions),
    wins,
    losses,
    irrelevant,
    // The audit supplies the evidence block; this display never fabricates it.
    evidenceMissing: true,
    overlap,
    posture,
  }
}
