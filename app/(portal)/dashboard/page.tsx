'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TopNavigation } from '../components/TopNavigation'
import { KpiCard } from '../components/KpiCard'
import { ReimbursementTable } from '../components/ReimbursementTable'
import { MaintenanceDistribution } from '../components/MaintenanceDistribution'

const KPI_DATA = [
  {
    id: 'employees',
    label: 'Total Employees Clocked In',
    icon: 'group',
    iconBgColor: 'bg-blue-50',
    iconColor: 'text-blue-600',
    value: '142/150',
    trend: 2,
    trendType: 'positive' as const
  },
  {
    id: 'reimbursements',
    label: 'Pending Reimbursements',
    icon: 'receipt_long',
    iconBgColor: 'bg-amber-50',
    iconColor: 'text-amber-600',
    value: 12,
    trend: 5,
    trendType: 'positive' as const
  },
  {
    id: 'maintenance',
    label: 'Active Maintenance Jobs',
    icon: 'settings_suggest',
    iconBgColor: 'bg-purple-50',
    iconColor: 'text-purple-600',
    value: 28,
    trend: -3,
    trendType: 'negative' as const
  },
  {
    id: 'productivity',
    label: 'Monthly Productivity %',
    icon: 'trending_up',
    iconBgColor: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    value: '94%',
    trend: 1,
    trendType: 'positive' as const
  }
]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) {
          router.push('/')
        } else {
          setUser(data.user)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push('/')
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNavigation user={user} />

      <main className="flex-1 overflow-y-auto bg-background-light">
        <div className="max-w-[1600px] mx-auto p-8">
          {/* KPI Cards */}
          <section aria-label="Key Performance Indicators" className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {KPI_DATA.map(card => (
                <KpiCard
                  key={card.id}
                  label={card.label}
                  value={card.value}
                  trend={card.trend}
                  trendType={card.trendType}
                  icon={card.icon}
                  iconBgColor={card.iconBgColor}
                  iconColor={card.iconColor}
                />
              ))}
            </div>
          </section>

          {/* Main Content Grid */}
          <section aria-label="Dashboard metrics and reports">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <ReimbursementTable />
              <MaintenanceDistribution />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
