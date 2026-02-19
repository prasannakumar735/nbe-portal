'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  BarChart3,
  List
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TopNavigation } from '../components/TopNavigation'
import TimeEntryForm from '../components/TimeEntryForm'
import WeeklySubmissionCard from '../components/WeeklySubmissionCard'
import DashboardAnalytics from '../components/DashboardAnalytics'
import { TimeEntryService } from '@/lib/services/timecard.service'
import { usePermissions } from '@/lib/hooks/usePermissions'
import type { TimeEntryWithDetails } from '@/lib/types/timecard.types'

export default function TimecardEnhancedPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [entries, setEntries] = useState<TimeEntryWithDetails[]>([])
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(getWeekStart(new Date()))
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntryWithDetails | null>(null)
  const [activeView, setActiveView] = useState<'entries' | 'analytics'>('entries')

  const { role, permissions, isLoading: permissionsLoading } = usePermissions(user?.id || '')

  // Check authentication on mount
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

  // Load entries for current week
  useEffect(() => {
    if (user) {
      loadEntries()
    }
  }, [user, currentWeekStart])

  function getWeekStart(date: Date): string {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
    d.setDate(diff)
    return d.toISOString().split('T')[0]
  }

  const loadEntries = async () => {
    if (!user) return
    
    try {
      const data = await TimeEntryService.getByWeek(user.id, currentWeekStart)
      setEntries(data)
    } catch (error) {
      console.error('Failed to load entries:', error)
    }
  }

  const handlePreviousWeek = () => {
    const date = new Date(currentWeekStart)
    date.setDate(date.getDate() - 7)
    setCurrentWeekStart(getWeekStart(date))
  }

  const handleNextWeek = () => {
    const date = new Date(currentWeekStart)
    date.setDate(date.getDate() + 7)
    setCurrentWeekStart(getWeekStart(date))
  }

  const handleEditEntry = (entry: TimeEntryWithDetails) => {
    setEditingEntry(entry)
    setShowEntryForm(true)
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return

    try {
      await TimeEntryService.delete(entryId)
      await loadEntries()
    } catch (error: any) {
      alert(error.message || 'Failed to delete entry')
    }
  }

  const handleFormSuccess = () => {
    setShowEntryForm(false)
    setEditingEntry(null)
    loadEntries()
  }

  const handleFormCancel = () => {
    setShowEntryForm(false)
    setEditingEntry(null)
  }

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading timecard...</p>
        </div>
      </div>
    )
  }

  const weekEnd = new Date(currentWeekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const totalWeekHours = entries.reduce((sum, e) => sum + e.hours, 0)
  const billableHours = entries.reduce((sum, e) => sum + (e.billable ? e.hours : 0), 0)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNavigation user={user} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>NBE Portal</span>
            <span className="text-[10px]">›</span>
            <span className="text-slate-600 font-medium">Timecard Management</span>
          </div>
          <div className="flex items-center gap-4">
            {role && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-100 text-blue-700">
                {role.toUpperCase()}
              </span>
            )}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              System Online
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 space-y-8 max-w-[1800px] mx-auto w-full flex-1 overflow-y-auto">
          {/* View Toggle */}
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-black">Timecard System</h1>
            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveView('entries')}
                className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center gap-2 ${
                  activeView === 'entries'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List size={16} />
                Time Entries
              </button>
              <button
                onClick={() => setActiveView('analytics')}
                className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center gap-2 ${
                  activeView === 'analytics'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 size={16} />
                Analytics
              </button>
            </div>
          </div>

          {activeView === 'entries' ? (
            <>
              {/* Week Navigation & Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Week Selector */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={handlePreviousWeek}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    
                    <div className="text-center">
                      <div className="flex items-center gap-2 justify-center mb-1">
                        <Calendar size={18} className="text-primary" />
                        <h2 className="text-xl font-black">Week View</h2>
                      </div>
                      <p className="text-sm text-slate-600">
                        {new Date(currentWeekStart).toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric',
                          year: 'numeric'
                        })} - {weekEnd.toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>

                    <button
                      onClick={handleNextWeek}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  {/* Week Summary */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                    <div className="text-center">
                      <div className="text-2xl font-black text-slate-900">{entries.length}</div>
                      <div className="text-xs text-slate-500 uppercase font-bold">Entries</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-primary">{totalWeekHours.toFixed(1)}h</div>
                      <div className="text-xs text-slate-500 uppercase font-bold">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-emerald-600">{billableHours.toFixed(1)}h</div>
                      <div className="text-xs text-slate-500 uppercase font-bold">Billable</div>
                    </div>
                  </div>
                </div>

                {/* Weekly Submission Card */}
                {user && role && (
                  <WeeklySubmissionCard
                    userId={user.id}
                    userRole={role}
                    weekStartDate={currentWeekStart}
                    onUpdate={loadEntries}
                  />
                )}
              </div>

              {/* Add Entry Button */}
              {permissions?.canCreateEntry && !showEntryForm && (
                <button
                  onClick={() => setShowEntryForm(true)}
                  className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-primary hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-slate-600 hover:text-primary font-bold"
                >
                  <Plus size={20} />
                  Add New Time Entry
                </button>
              )}

              {/* Entry Form */}
              {showEntryForm && user && (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                  <h3 className="text-lg font-bold mb-4">
                    {editingEntry ? 'Edit Time Entry' : 'New Time Entry'}
                  </h3>
                  <TimeEntryForm
                    userId={user.id}
                    initialDate={currentWeekStart}
                    onSuccess={handleFormSuccess}
                    onCancel={handleFormCancel}
                    editingEntry={editingEntry}
                  />
                </div>
              )}

              {/* Entries Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-200">
                  <h2 className="text-lg font-bold">Time Entries</h2>
                  <p className="text-sm text-slate-500">This week's recorded time</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Date
                        </th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Work Type
                        </th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Project
                        </th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                          Hours
                        </th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                          Billable
                        </th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {entries.map(entry => (
                        <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="font-bold text-sm">
                              {new Date(entry.entry_date).toLocaleDateString('en-US', { 
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="font-bold text-sm">{entry.work_type_level2_description}</div>
                            <div className="text-xs text-slate-500">{entry.work_type_level1_description}</div>
                          </td>
                          <td className="px-8 py-5">
                            {entry.project_name ? (
                              <>
                                <div className="font-medium text-sm">{entry.project_code}</div>
                                <div className="text-xs text-slate-500">{entry.client_name}</div>
                              </>
                            ) : (
                              <span className="text-sm text-slate-400">N/A</span>
                            )}
                          </td>
                          <td className="px-8 py-5 text-center">
                            <span className="px-3 py-1 rounded-full text-xs font-bold tabular-nums bg-slate-100 text-slate-900">
                              {entry.hours.toFixed(2)}h
                            </span>
                          </td>
                          <td className="px-8 py-5 text-center">
                            {entry.billable ? (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                Yes
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {permissions?.canEditEntry && !entry.weekly_submission_id && (
                                <button
                                  onClick={() => handleEditEntry(entry)}
                                  className="p-2 hover:bg-blue-50 text-primary rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                              )}
                              {permissions?.canDeleteEntry && !entry.weekly_submission_id && (
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {entries.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-slate-500">No time entries for this week</p>
                      <p className="text-xs text-slate-400 mt-2">Click "Add New Time Entry" to get started</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            // Analytics View
            user && role && (
              <DashboardAnalytics 
                userId={user.id} 
                userRole={role}
              />
            )
          )}
        </div>
      </div>
    </div>
  )
}
