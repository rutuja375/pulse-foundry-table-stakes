'use client'

/**
 * Definitions — hover, focus and tap.
 *
 * The ported version was hover-only, which is the wrong default for a reader who
 * does not know our patterns: on a tablet there is no hover, and a keyboard user
 * could never reach it. Three changes:
 *
 *   1. THE TRIGGER IS VISIBLE. A dotted underline (or a small ⓘ) says "there is
 *      a definition here" before anyone moves a mouse. An unexplained hover
 *      region is a secret.
 *   2. KEYBOARD AND TOUCH WORK. The trigger is focusable and the definition
 *      opens on focus; a tap pins it open, a second tap closes it.
 *   3. IT ANNOUNCES ITSELF. role=tooltip, aria-describedby wiring, Escape closes.
 *
 * Still hover-first, because that is the convention people recognise — this only
 * makes the same convention work for everyone else.
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
  align?: 'left' | 'right'
  title?: string
  width?: string
  /** How the trigger announces itself. Dotted underline is the default for text. */
  marker?: 'dotted' | 'icon' | 'none'
}

export function Tooltip({
  content,
  children,
  align = 'left',
  title = 'Details',
  width,
  marker = 'dotted',
}: TooltipProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pinned, setPinned] = useState(false)
  const id = useId()
  const root = useRef<HTMLSpanElement>(null)

  const open = hovered || focused || pinned

  useEffect(() => {
    if (!pinned) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinned(false)
    }
    const onClickAway = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setPinned(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClickAway)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClickAway)
    }
  }, [pinned])

  return (
    <span
      ref={root}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={marker === 'dotted' ? 'tip-trigger' : undefined}
        tabIndex={0}
        role="button"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={event => {
          // Tap support: a pointer device that cannot hover gets a pin instead.
          event.preventDefault()
          setPinned(current => !current)
        }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help' }}
      >
        {children}
        {marker === 'icon' && (
          <span aria-hidden="true" className="tip-icon">
            ?
          </span>
        )}
      </span>

      {open && content && (
        <span
          role="tooltip"
          id={id}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: align === 'left' ? 0 : 'auto',
            right: align === 'right' ? 0 : 'auto',
            width: width || '280px',
            minWidth: '100%',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '12px 14px',
            boxShadow: 'var(--popover-depth)',
            zIndex: 60,
            textAlign: 'left',
            whiteSpace: 'normal',
          }}
        >
          <span
            style={{
              display: 'block',
              fontWeight: 700,
              fontSize: 12.5,
              color: 'var(--fg)',
              borderBottom: '1px solid var(--border)',
              paddingBottom: 5,
              marginBottom: 6,
            }}
          >
            {title}
          </span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--fg2)', lineHeight: 1.45 }}>{content}</span>
        </span>
      )}
    </span>
  )
}
