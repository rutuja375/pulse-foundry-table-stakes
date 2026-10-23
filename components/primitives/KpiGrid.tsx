'use client'

import { KpiCard } from './KpiCard'

/**
 * KPI row. Ported unchanged: equal columns, 12px gap, tooltip alignment
 * auto-picked from the card's position (edges align outward, middle centers)
 * so a tooltip never overflows the card container at either end.
 */

interface KpiItem {
  label: string
  value: string
  delta?: string
  deltaDirection?: 'up' | 'down' | 'neutral'
  valueColor?: string
  tooltip?: React.ReactNode
  tooltipAlign?: 'left' | 'right' | 'center'
  variant?: 'brand-accent' | 'pos' | 'neg' | 'neu'
}

interface KpiGridProps {
  items: KpiItem[]
  columns?: number
}

export function KpiGrid({ items, columns = 4 }: KpiGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 12,
      }}
    >
      {items.map((item, i) => {
        const defaultAlign =
          columns > 1
            ? (i % columns === columns - 1)
              ? 'right'
              : (i % columns === 0)
              ? 'left'
              : 'center'
            : 'left'

        const align = item.tooltipAlign ?? defaultAlign

        return (
          <KpiCard
            key={item.label}
            label={item.label}
            value={item.value}
            valueColor={item.valueColor}
            delta={item.delta}
            deltaDirection={item.deltaDirection}
            variant={item.variant}
            tooltipContent={item.tooltip}
            tooltipAlign={align}
          />
        )
      })}
    </div>
  )
}
