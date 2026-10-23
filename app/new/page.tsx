import { StartDetails } from '@/components/new/StartDetails'

/**
 * The start screen. No card, no rail, no explanation: a headline and three
 * hairline fields. The details are what make the search correct, so they are the
 * only thing on the page.
 */
export default function NewPage() {
  return (
    <div className="pane pane-wide">
      <StartDetails />
    </div>
  )
}
