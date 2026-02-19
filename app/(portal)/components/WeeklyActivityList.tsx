'use client'

import { useState } from 'react'
import { ChevronDown, MoreVertical, Clock, CheckCircle } from 'lucide-react'

interface ActivityEntry {
  id: string
  date: string
  dayOfWeek: string
  workType: {
    level1: string
    level1Code: string
    level2: string
    level2Code: string
  }
  client: string
  location: string
  startTime: string
  endTime: string
  duration: string
  status: 'completed' | 'active' | 'pending'
}

interface WeeklyActivityListProps {
  entries: ActivityEntry[]
  isLoading?: boolean
}

export default function WeeklyActivityList({ entries, isLoading = false }: WeeklyActivityListProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  // Group entries by date
  const entriesByDay = entries.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = []
    }
    acc[entry.date].push(entry)
    return acc
  }, {} as Record<string, ActivityEntry[]>)

  const sortedDates = Object.keys(entriesByDay).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-300 border-t-purple-600"></div>
          <p className="text-sm text-gray-500">Loading activity history...</p>
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">No time entries yet</p>
        <p className="text-sm text-gray-500 mt-1">Start tracking your work to see activity history</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sortedDates.map(date => (
        <div key={date} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* Day Header - Sticky */}
          <div
            onClick={() => setExpandedDay(expandedDay === date ? null : date)}
            className="sticky top-0 bg-gradient-to-r from-purple-50 via-white to-purple-50/50 px-6 py-4 border-b border-gray-100 cursor-pointer hover:from-purple-100/50 hover:via-white hover:to-purple-100/50 transition-all duration-200 flex items-center justify-between z-10 group"
          >
            <div className="flex items-center gap-3">
              <ChevronDown
                size={20}
                className={`text-gray-400 group-hover:text-gray-600 transition-all duration-200 transform ${expandedDay === date ? 'rotate-180' : ''}`}
              />
              <div>
                <p className="font-bold text-slate-900 text-lg">
                  {new Date(date).toLocaleDateString('en-AU', { 
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">
                  {entriesByDay[date].length} {entriesByDay[date].length === 1 ? 'entry' : 'entries'} logged
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black text-slate-900 text-2xl">
                {entriesByDay[date]
                  .reduce((sum, entry) => {
                    const parts = entry.duration.split(':').map(Number)
                    return sum + (parts[0] || 0) + (parts[1] || 0) / 60
                  }, 0)
                  .toFixed(1)}h
              </p>
              <p className="text-xs text-gray-500 font-semibold">Total Hours</p>
            </div>
          </div>

          {/* Day Entries */}
          {expandedDay === date && (
            <div className="divide-y divide-gray-100">
              {entriesByDay[date].map((entry, idx) => (
                <div
                  key={entry.id}
                  className="p-6 hover:bg-gradient-to-r hover:from-purple-50/70 hover:via-white hover:to-transparent transition-all duration-200 group relative border-l-4 border-l-transparent hover:border-l-purple-500 active:scale-98 transform hover:scale-[1.01]"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                    {/* Left - Work Type & Client */}
                    <div className="md:col-span-1">
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                          Work Type
                        </p>
                        <p className="font-bold text-slate-900">
                          {entry.workType.level1Code}
                        </p>
                        <p className="text-sm text-gray-600">
                          {entry.workType.level1}
                        </p>
                      </div>
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                          Task
                        </p>
                        <p className="font-bold text-slate-900 text-sm">
                          {entry.workType.level2Code}
                        </p>
                        <p className="text-xs text-gray-600">
                          {entry.workType.level2}
                        </p>
                      </div>
                    </div>

                    {/* Client & Location */}
                    <div className="md:col-span-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                        Client
                      </p>
                      <p className="font-bold text-slate-900 mb-4">
                        {entry.client}
                      </p>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                        Location
                      </p>
                      <p className="text-sm font-semibold text-slate-700 bg-gradient-to-r from-purple-50 to-transparent px-3 py-1.5 rounded-lg w-fit">
                        {entry.location}
                      </p>
                    </div>

                    {/* Time */}
                    <div className="md:col-span-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                        Time Range
                      </p>
                      <div className="space-y-2 bg-slate-50 rounded-lg p-3">
                        <div>
                          <p className="text-xs text-gray-500 font-medium">From</p>
                          <p className="font-mono text-sm font-bold text-slate-900">
                            {entry.startTime}
                          </p>
                        </div>
                        <div className="border-t border-gray-200 pt-2">
                          <p className="text-xs text-gray-500 font-medium">To</p>
                          <p className="font-mono text-sm font-bold text-slate-900">
                            {entry.endTime || '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Duration & Status */}
                    <div className="md:col-span-1 flex flex-col items-start md:items-end justify-between h-full">
                      <div className="text-left md:text-right w-full">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                          Duration
                        </p>
                        <p className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-700 leading-tight">
                          {entry.duration}
                        </p>
                      </div>

                      {/* Status Badge & Menu */}
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mt-4 w-full md:w-auto md:justify-end">
                        {entry.status === 'completed' && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-transparent border border-emerald-100 rounded-lg">
                            <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-emerald-700 uppercase tracking-tight">
                              Completed
                            </span>
                          </div>
                        )}
                        {entry.status === 'active' && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-transparent border border-purple-100 rounded-lg">
                            <div className="animate-pulse h-2.5 w-2.5 bg-purple-500 rounded-full shadow-lg shadow-purple-500/50"></div>
                            <span className="text-xs font-bold text-purple-700 uppercase tracking-tight">
                              Active
                            </span>
                          </div>
                        )}

                        {/* Menu Button */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenu(activeMenu === entry.id ? null : entry.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-gray-200/50 rounded-lg"
                          >
                            <MoreVertical size={16} className="text-gray-500" />
                          </button>
                          {activeMenu === entry.id && (
                            <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-xl z-20 min-w-max">
                              <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg transition-colors">
                                View Details
                              </button>
                              <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors">
                                Edit
                              </button>
                              <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50/50 border-t border-gray-100 last:rounded-b-lg transition-colors">
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
