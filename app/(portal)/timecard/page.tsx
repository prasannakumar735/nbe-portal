import { redirect } from 'next/navigation'

export default function TimecardRedirectPage() {
  redirect('/dashboard/timecards?tab=my')
}
