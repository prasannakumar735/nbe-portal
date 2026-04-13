'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateOwnProfile } from '@/lib/users/actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type EditProfileFormProps = {
  email: string
  initialFullName: string
  initialPhone: string
}

export function EditProfileForm({ email, initialFullName, initialPhone }: EditProfileFormProps) {
  const router = useRouter()
  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState(initialPhone)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setFullName(initialFullName)
    setPhone(initialPhone)
  }, [initialFullName, initialPhone])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await updateOwnProfile({ fullName, phone })
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Profile saved')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <Input
        id="profile-email"
        label="Email"
        value={email}
        readOnly
        disabled
        className="bg-slate-50 text-slate-600"
      />
      <Input
        id="profile-full-name"
        label="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
        disabled={loading}
        autoComplete="name"
      />
      <Input
        id="profile-phone"
        label="Phone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={loading}
        autoComplete="tel"
        placeholder="Optional"
      />
      <Button type="submit" loading={loading}>
        Save changes
      </Button>
    </form>
  )
}
