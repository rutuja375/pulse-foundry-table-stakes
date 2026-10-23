import { RunClient } from '@/components/run/RunClient'
import { loadLatestRun } from '@/lib/view/load-run'
import { seedFromRun } from '@/lib/preflight/seed'

/**
 * Preflight screen. The query parameters are what the start form asked for;
 * until the live pipeline exists they only decide what the banner admits to.
 */
export default async function RunPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string; city?: string; q?: string }>
}) {
  const params = await searchParams
  const loaded = loadLatestRun()

  if (!loaded) {
    return (
      <div className="pane">
        <h1 className="pane-title">Nothing to ask yet</h1>
        <p className="pane-lede">Drop a run payload into data/runs/ and this screen replays it.</p>
      </div>
    )
  }

  const seed = seedFromRun(loaded.report)
  const requested = params.venue?.trim() || null
  const replayOf = seed.venue

  return <RunClient seed={seed} requested={requested} replayOf={replayOf} />
}
