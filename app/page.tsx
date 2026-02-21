'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function Home() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Please enter both email and password.')
      return
    }

    try {
      setIsSubmitting(true)

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        alert(error.message)
        return
      }

      router.push('/dashboard')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected login error.'

      if (message.toLowerCase().includes('failed to fetch')) {
        alert('Unable to reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and verify internet access.')
        return
      }

      alert(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-2xl font-bold">NBE Portal Login</h1>

      <input
        type="email"
        placeholder="Email"
        className="border p-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        className="border p-2"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleLogin}
        disabled={isSubmitting}
        className="bg-blue-500 text-white px-4 py-2 disabled:opacity-60"
      >
        {isSubmitting ? 'Logging in...' : 'Login'}
      </button>
    </div>
  )
}
