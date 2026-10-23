import { OverviewPane } from '@/components/report/OverviewPane'
import { loadLatestRun } from '@/lib/view/load-run'

export default async function Page() {
  const loaded = loadLatestRun()

  if (!loaded) {
    return (
      <div className="pane">
        <h1 className="pane-title">No run to show</h1>
        <p className="pane-lede">
          Drop a run payload into <code>data/runs/</code> — or point this page at the backend endpoint once it
          exists. The report does not care which shape it receives.
        </p>
      </div>
    )
  }

  return <OverviewPane report={loaded.report} />
}
