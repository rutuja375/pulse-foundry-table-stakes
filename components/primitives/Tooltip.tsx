'use client'

import { useState } from 'react'

/**
 * Hover tooltip. Ported unchanged in behaviour:
 *  - hover only, absolute below the trigger, pointer-events:none so it can
 *    never trap the cursor
 *  - align left/right to keep it inside narrow columns
 *  - title bar + body
 * Use for KPI definitions. For anything longer than two lines, use Drawer —
 * a hover surface that long is unreadable and inaccessible.
 */
export function Tooltip({
  content,
  children,
  align = 'left',
  title = 'Details',
  width,
  fontSize,
}: {
  content: string
  children: React.ReactNode
  align?: 'left' | 'right'
  title?: string
  width?: string
  fontSize?: string
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ position: 'relative', display: 'inline-block', width: '100%' }}
    >
      {children}
      {isHovered && content && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: align === 'left' ? 0 : 'auto',
            right: align === 'right' ? 0 : 'auto',
            width: width || '280px',
            minWidth: '100%',
            background: 'var(--card-bg, #fff)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--tooltip-radius, 8px)',
            padding: '12px 14px',
            boxShadow: 'var(--card-shadow)',
            zIndex: 45,
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          {title && (
            <div
              style={{
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--fg)',
                borderBottom: '1px solid var(--border)',
                paddingBottom: 4,
                marginBottom: 6,
                width: '100%',
              }}
            >
              {title}
            </div>
          )}
          <div style={{ fontSize: fontSize || '12px', color: 'var(--fg2)', lineHeight: 1.4 }}>{content}</div>
        </div>
      )}
    </div>
  )
}
