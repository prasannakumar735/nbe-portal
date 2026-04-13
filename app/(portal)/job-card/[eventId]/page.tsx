import { JobCardScreen } from '@/components/job-card/JobCardScreen'

type PageProps = {
  params: Promise<{ eventId: string }>
}

export default async function JobCardEventPage({ params }: PageProps) {
  const { eventId } = await params
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 md:px-6">
      <JobCardScreen eventId={eventId} />
    </div>
  )
}
