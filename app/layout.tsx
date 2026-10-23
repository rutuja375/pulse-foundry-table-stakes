import type { Metadata } from 'next'
import { Hanken_Grotesk, JetBrains_Mono, Spectral } from 'next/font/google'
import './globals.css'
import { Rail } from '@/components/shell/Rail'
import { StaleBuildGuard } from '@/components/shell/StaleBuildGuard'
import { loadLatestRun, railRivals } from '@/lib/view/load-run'
import { formatDate } from '@/lib/view/derive'
import { buildFixes } from '@/lib/view/solutions'

/**
 * THODI's typeface trio, adopted as-is:
 *   Spectral          headlines and figures (the KPI scale is 900 weight)
 *   Hanken Grotesk    everything you read
 *   JetBrains Mono    data columns, so digits align
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

/** Payload comes off disk at request time, never baked at build time. */
export const dynamic = 'force-dynamic'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const loaded = loadLatestRun()
  const report = loaded?.report

  return (
    <html lang="en" className={`${spectral.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>
        <StaleBuildGuard />
        <div className="shell">
          {report ? (
            <Rail
              venue={report.venue.name}
              place={[report.venue.neighbourhood, report.venue.city].filter(Boolean).join(', ')}
              runId={report.runId}
              date={formatDate(report.startedAt)}
              rivals={railRivals(report)}
              actionCount={buildFixes(report).length}
            />
          ) : null}
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  )
}
