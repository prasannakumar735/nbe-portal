import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ quoteId: string }>
}

export default async function RapidDoorViewQuoteRedirectPage({ params }: Props) {
  const { quoteId } = await params
  redirect(`/dashboard/quotes/service/${quoteId}`)
}
