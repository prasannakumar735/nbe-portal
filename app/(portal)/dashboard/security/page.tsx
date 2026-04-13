import { redirect } from 'next/navigation'

/** Legacy alias — canonical route is `/dashboard/change-password`. */
export default function DashboardSecurityRedirectPage() {
  redirect('/dashboard/change-password')
}
