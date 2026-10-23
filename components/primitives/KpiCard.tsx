'use client'

import React, { useState } from 'react'
import clsx from 'clsx'

/**
 * KPI card. Ported from the source design system.
 * Kept: label / value / subValue / delta stack, hover tooltip that renders
 * "label: value" pairs as a dotted leader table, hover z-index lift.
 * Changed: class names (kpi-card*), English tooltip heading, no brand tokens.
 */

export interface KpiCardProps {
  label: string
  value: React.ReactNode
  valueColor?: string
  subValue?: React.ReactNode
  subValueColor?: string
  delta?: React.ReactNode
  deltaColor?: string
  deltaDirection?: 'up' | 'down' | 'neutral'
  tooltipContent?: React.ReactNode
  tooltipAlign?: 'left' | 'right' | 'center'
  variant?: 'brand-accent' | 'pos' | 'neg' | 'neu'
  className?: string
  style?: React.CSSProperties
}

export function KpiCard({
  label,
  value,
  valueColor = 'var(--fg)',
  subValue,
  subValueColor = 'var(--positive)',
  delta,
  deltaColor,
  deltaDirection,
  tooltipContent,
  tooltipAlign = 'left',
  variant,
  className,
  style,
}: KpiCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const resolvedDeltaColor =
    deltaColor ??
    (deltaDirection === 'up'
      ? 'var(--positive, #1a1c1b)'
      : deltaDirection === 'down'
      ? 'var(--negative, #c0392b)'
      : 'var(--muted)')

  return (
    <div
      className={clsx('kpi-card', variant && `kpi-card--${variant}`, className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ position: 'relative', zIndex: isHovered ? 40 : 1, ...style }}
    >
      <div
        style={{
          color: 'var(--muted)',
          fontSize: 'var(--label-size)',
          fontWeight: 'var(--label-weight)' as React.CSSProperties['fontWeight'],
          letterSpacing: 'var(--label-tracking)',
          marginBottom: 8,
          textTransform: 'var(--label-case)' as React.CSSProperties['textTransform'],
        }}
      >
        {label}
      </div>

      <div
        className="kpi-value-text"
        style={{
          color: variant ? undefined : valueColor,
          fontSize: 'var(--kpi-size)',
          fontWeight: 'var(--kpi-weight)' as React.CSSProperties['fontWeight'],
          letterSpacing: 'var(--kpi-tracking)',
          fontFamily: 'var(--kpi-font)',
          lineHeight: 1.1,
          marginBottom: subValue ? 3 : delta ? 4 : 0,
        }}
      >
        {value}
      </div>

      {subValue && (
        <div
          className="num"
          style={{
            color: subValueColor,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            marginBottom: delta ? 4 : 0,
          }}
        >
          {subValue}
        </div>
      )}

      {delta && (
        <div style={{ color: resolvedDeltaColor, fontSize: 11, fontWeight: 500 }}>{delta}</div>
      )}

      {isHovered && tooltipContent && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: tooltipAlign === 'center' ? '50%' : tooltipAlign === 'right' ? 'auto' : 0,
            right: tooltipAlign === 'center' ? 'auto' : tooltipAlign === 'right' ? 0 : 'auto',
            transform: tooltipAlign === 'center' ? 'translateX(-50%)' : 'none',
            width: 'max-content',
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
          {typeof tooltipContent === 'string' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: 'var(--fg)',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 4,
                  marginBottom: 2,
                }}
              >
                Details
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {tooltipContent.split('\n').map((line, idx) => {
                  const colonIndex = line.indexOf(':')
                  if (colonIndex !== -1) {
                    const key = line.substring(0, colonIndex).trim()
                    const val = line.substring(colonIndex + 1).trim()
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--fg2)' }}>
                        <span>{key}</span>
                        <div style={{ flex: 1, borderBottom: '1px dotted var(--border)', margin: '0 8px', alignSelf: 'flex-end', marginBottom: 3 }} />
                        <span style={{ fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{val}</span>
                      </div>
                    )
                  }
                  return (
                    <div key={idx} style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.35 }}>
                      {line}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            tooltipContent
          )}
        </div>
      )}
    </div>
  )
}
