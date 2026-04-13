import { redirect } from 'next/navigation'

/** Alias URL for marketing/docs — same as `/client/login`. */
export default function ClientLoginAliasPage() {
  redirect('/client/login')
}
