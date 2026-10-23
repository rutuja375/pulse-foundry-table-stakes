'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

/**
 * Right-hand drill-down panel.
 *
 * Behaviour chosen from the source design system's breakdown drawer, rewritten
 * generic: a click (never hover) opens it, ESC and backdrop close it, the page
 * behind stops scrolling, focus moves into the panel and returns on close.
 * Content is passed in — the drawer fetches nothing itself, so the caller can
 * decide whether the detail was already in memory or needs a request.
 */

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Small label above the title — what kind of thing this is. */
  eyebrow?: string
  /** Anything that belongs to the masthead: a figure, a strip, a chart. */
  below?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
}

export function Drawer({ open, onClose, title, subtitle, eyebrow, below, children, footer, width = 520 }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreFocusTo.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusable?.focus()
    }, 40)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreFocusTo.current?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(20, 20, 18, 0.28)',
              zIndex: 90,
            }}
          />
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: width }}
            animate={{ x: 0 }}
            exit={{ x: width }}
            transition={{ type: 'tween', duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: `min(${width}px, 100vw)`,
              background: 'var(--card-bg)',
              borderLeft: '1px solid var(--border)',
              zIndex: 91,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <header
              style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                {eyebrow && (
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: 'var(--accent)',
                      marginBottom: 6,
                    }}
                  >
                    {eyebrow}
                  </div>
                )}
                {/* Serif here too: the drawer is a page from the report, not a dialog box. */}
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--kpi-font)',
                    fontSize: 22,
                    fontWeight: 500,
                    color: 'var(--fg)',
                    lineHeight: 1.25,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {title}
                </h2>
                {subtitle && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11.5,
                      color: 'var(--muted)',
                      fontFamily: 'var(--font-data)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {subtitle}
                  </div>
                )}
                {below && <div style={{ marginTop: 16 }}>{below}</div>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  width: 30,
                  height: 30,
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  color: 'var(--fg2)',
                  flex: 'none',
                }}
              >
                <X size={15} />
              </button>
            </header>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>

            {footer && (
              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--surf-1)' }}>
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
