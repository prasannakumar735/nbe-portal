import { redirect } from 'next/navigation'

export default function DashboardUsersRedirectPage() {
  redirect('/dashboard/people?tab=users')
}
