import { ConfirmSite } from '@/components/new/ConfirmSite'

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string; place?: string }>
}) {
  const params = await searchParams
  const venue = params.venue?.trim() || 'Café Athena'
  const place = params.place?.trim() || 'Pacific Beach, San Diego'

  return <ConfirmSite venue={venue} place={place} />
}
