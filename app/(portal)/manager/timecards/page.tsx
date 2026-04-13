import { redirect } from 'next/navigation'

export default function ManagerTimecardsRedirectPage() {
  redirect('/dashboard/timecards?tab=team')
}
