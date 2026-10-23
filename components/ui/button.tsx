'use client'

/**
 * Buttons.
 *
 * Ported from the THODI design system's four variants — primary, secondary,
 * quiet, danger — with two deliberate changes for this product:
 *
 *   1. DEPTH. THODI's buttons are flat because Serene Precision separates
 *      surfaces with tone. Aegean uses hairlines, so a button with no border and
 *      no shadow reads as text. Here every button has a 1px border, a 1px
 *      shadow at rest, and drops its shadow on press. The rule is "a button
 *      looks pressable without being hovered", because we cannot assume the
 *      reader knows our patterns — they know everyone else's.
 *   2. COPY. Loading says what is happening ("Preparing…"), never a spinner with
 *      no words, and never "Submit".
 *
 * Height is 40px minimum, 44px on touch — a target you can hit without aiming.
 */

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  icon?: ReactNode
  full?: boolean
}

const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'var(--active-accent)',
    color: 'var(--on-accent)',
    border: '1px solid var(--active-accent)',
  },
  secondary: {
    background: 'var(--card-bg)',
    color: 'var(--fg)',
    border: '1px solid var(--border-strong)',
  },
  quiet: {
    background: 'transparent',
    color: 'var(--fg2)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'var(--negative)',
    color: '#fff',
    border: '1px solid var(--negative)',
  },
}

export function Button({
  variant = 'secondary',
  loading = false,
  disabled,
  children,
  icon,
  full = false,
  style,
  ...props
}: ButtonProps) {
  const inert = disabled || loading

  return (
    <button
      {...props}
      disabled={inert}
      className={`btn btn--${variant}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 40,
        padding: '0 16px',
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
        cursor: inert ? 'not-allowed' : 'pointer',
        opacity: inert ? 0.55 : 1,
        width: full ? '100%' : undefined,
        transition: 'background-color 120ms ease, box-shadow 120ms ease, transform 60ms ease',
        ...VARIANTS[variant],
        ...style,
      }}
    >
      {loading ? (
        <>
          <span className="btn-spinner" aria-hidden="true" />
          Preparing…
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  )
}
