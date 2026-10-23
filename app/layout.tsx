import type { Metadata } from 'next'
import { Hanken_Grotesk, JetBrains_Mono, Spectral } from 'next/font/google'
import './globals.css'

/**
 * THODI's typeface trio, adopted as-is:
 *   Spectral          headlines and figures (the KPI scale is 900 weight)
 *   Hanken Grotesk    everything you read
 *   JetBrains Mono    data columns, so digits align
 *
 * Self-hosted by next/font — no runtime request, no layout shift.
 */

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-spectral',
  display: 'swap',
})

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-hanken-grotesk',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AI visibility audit',
  description: 'What five AI assistants say when someone asks about your restaurant.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spectral.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
