'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Home page - redirects to login
 * 
 * The actual login form is at /login/page.tsx
 */
export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to login page
    router.replace('/login')
  }, [router])

  // Show nothing while redirecting
  return null
}
