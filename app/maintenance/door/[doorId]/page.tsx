import { redirect } from 'next/navigation'

type DoorPageProps = {
  params: Promise<{
    doorId: string
  }>
}

export default async function MaintenanceDoorPage({ params }: DoorPageProps) {
  const { doorId } = await params
  redirect(`/door/${encodeURIComponent(doorId)}`)
}
