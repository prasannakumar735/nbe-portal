import { redirect } from 'next/navigation'

export default function AdminContactsRedirectPage() {
  redirect('/dashboard/people?tab=contacts')
}
