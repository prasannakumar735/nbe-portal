import { redirect } from 'next/navigation'

export default function ClientLoginAliasPage() {
  redirect('/login?next=/client')
}
