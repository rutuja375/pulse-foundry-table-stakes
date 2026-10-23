import { VenueForm } from '@/components/run/VenueForm'

export default function NewPage() {
  return (
    <div className="pane">
      <header className="pane-head">
        <div className="head-row">
          <span className="eyebrow">New audit</span>
          <span className="eyebrow mono-label-soft">5 assistants · one run</span>
        </div>
        <h1 className="venue-title" style={{ fontSize: 34 }}>
          Start with the restaurant
        </h1>
        <p className="pane-lede">
          Five assistants are asked the same twenty questions a customer would ask. What comes back is recorded
          verbatim, and every number in the report is counted from those answers.
        </p>
      </header>

      <VenueForm />
    </div>
  )
}
