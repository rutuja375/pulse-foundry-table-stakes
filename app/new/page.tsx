import { StartComposer } from '@/components/new/StartComposer'

/**
 * The start screen. No card, no form: a headline, a hairline composer, and a
 * panel on the right explaining what the next ninety seconds will do.
 */
export default function NewPage() {
  return (
    <div className="pane pane-wide">
      <StartComposer />
    </div>
  )
}
