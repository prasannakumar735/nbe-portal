'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function Home() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (!email || !password) {
      alert('Please enter both email and password.')
      return
    }

    try {
      setIsSubmitting(true)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        alert(error.message)
        return
      }

      if (data.user) {
        router.push('/dashboard')
      }
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
    <div className="flex flex-col items-center justify-center h-screen gap-6 bg-slate-50">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">NBE Portal Login</h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="space-y-1">
            <label htmlFor="login-email" className="text-sm font-medium text-slate-700">Email Address</label>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="name@company.com"
              className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="login-password" className="text-sm font-medium text-slate-700">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-60 transition-colors shadow-sm"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
