import { NextResponse } from 'next/server'
import { checkDomain } from '@/lib/site/lookup'

/**
 * One domain check per request. The confirmation screen walks the candidate list
 * so each row can show its own state instead of waiting on the slowest guess.
 */
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain')?.trim()
  const reason = searchParams.get('reason')?.trim() || 'candidate'
  const name = searchParams.get('name')?.trim() || ''

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return NextResponse.json({ error: 'A plain domain is required, e.g. cafeathenasd.com' }, { status: 400 })
  }

  const result = await checkDomain(domain, reason, name)
  return NextResponse.json(result)
}
