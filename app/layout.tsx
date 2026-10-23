import type { Metadata } from 'next'
import { Playfair_Display, Montserrat } from 'next/font/google'
import './globals.css'

/**
 * Aegean Hospitality type pairing.
 * Playfair Display carries KPI values and headlines; Montserrat carries
 * labels, body copy and tabular figures. Both are self-hosted by next/font, so
 * there is no runtime request to Google and no layout shift.
 */

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-playfair',
  display: 'swap',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Pulse Foundry — AI visibility audit',
  description: 'Aegean Hospitality design system · Café Athena, Pacific Beach',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  )
}
