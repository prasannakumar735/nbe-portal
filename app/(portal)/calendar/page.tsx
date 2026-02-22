'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  ChevronRight,
  Bell,
  Plus,
  Info,
  X,
  Trash2
} from 'lucide-react'

interface Event {
  id: string
  title: string
  description?: string
  event_date: string
  start_time?: string
  end_time?: string
  all_day: boolean
  category: string
  location?: string
  created_by: string
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  maintenance: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  finance: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  sales: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
  general: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' }
}

export default function CalendarPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'agenda'>('month')
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [filters, setFilters] = useState({
    maintenance: true,
    finance: true,
    sales: true,
    general: true
  })
  const [showNewEventModal, setShowNewEventModal] = useState(false)
  const [newEventData, setNewEventData] = useState({
    title: '',
    description: '',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    all_day: false,
    category: 'general',
    location: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check authentication and fetch events
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) {
          router.push('/')
        } else {
          setUser(data.user)
          await fetchEvents()
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

  // Fetch events when month changes
  useEffect(() => {
    if (user) {
      fetchEvents()
    }
  }, [currentDate, user])

  // Fetch events from Supabase
  const fetchEvents = async () => {
    try {
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', firstDay.toISOString().split('T')[0])
        .lte('event_date', lastDay.toISOString().split('T')[0])
        .order('event_date', { ascending: true })

      if (error) throw error

      setEvents((data as Event[]) || [])
    } catch (error) {
      console.error('Failed to fetch events:', error)
    }
  }

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  // Get first day of month (0 = Sunday, 6 = Saturday)
  const getFirstDay = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  // Get events for specific date
  const getEventsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(day).padStart(2, '0')}`

    return events.filter(
      event =>
        event.event_date === dateStr && filters[event.category as keyof typeof filters]
    )
  }

  // Navigate to previous month
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  // Navigate to next month
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  // Reset to today
  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Toggle filter
  const toggleFilter = (category: keyof typeof filters) => {
    setFilters(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  // Create new event
  const handleCreateEvent = async () => {
    if (!newEventData.title || !newEventData.event_date || !user) {
      alert('Please fill in required fields')
      return
    }

    setIsSubmitting(true)
    try {
      const eventToInsert = {
        ...newEventData,
        created_by: user.id
      }

      const { data, error } = await supabase
        .from('events')
        .insert([eventToInsert])
        .select()

      if (error) throw error

      // Update local state immediately with new event
      if (data && data.length > 0) {
        setEvents(prev => [...prev, data[0] as Event])
      }

      setShowNewEventModal(false)
      setNewEventData({
        title: '',
        description: '',
        event_date: new Date().toISOString().split('T')[0],
        start_time: '',
        end_time: '',
        all_day: false,
        category: 'general',
        location: ''
      })
    } catch (error) {
      console.error('Failed to create event:', error)
      alert('Failed to create event')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete event (only if user is creator)
  const handleDeleteEvent = async (event: Event) => {
    if (event.created_by !== user?.id) {
      alert('You can only delete your own events')
      return
    }

    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const { error } = await supabase.from('events').delete().eq('id', event.id)

      if (error) throw error

      await fetchEvents()
      setSelectedEvent(null)
    } catch (error) {
      console.error('Failed to delete event:', error)
      alert('Failed to delete event')
    }
  }

  // Get upcoming events
  const getUpcomingEvents = () => {
    const now = new Date()
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    return events
      .filter(event => {
        const eventDate = new Date(event.event_date)
        return (
          eventDate >= now &&
          eventDate <= oneWeekLater &&
          filters[event.category as keyof typeof filters]
        )
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .slice(0, 4)
  }

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDay(currentDate)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading calendar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="flex-1 flex overflow-hidden">
        {/* Main Calendar */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Controls */}
          <div className="p-6 bg-white border-b border-slate-200">
            {/* Top Row: Filters */}
            <div className="flex items-center space-x-4 mb-4">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Filters</span>
              <div className="flex flex-wrap gap-2">
                {Object.keys(CATEGORY_COLORS).map(key => (
                  <label
                    key={key}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                      filters[key as keyof typeof filters]
                        ? `${CATEGORY_COLORS[key].bg} ${CATEGORY_COLORS[key].text} border-slate-300`
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >
                    <input
                      checked={filters[key as keyof typeof filters]}
                      onChange={() => toggleFilter(key as keyof typeof filters)}
                      type="checkbox"
                      className="w-3 h-3 rounded"
                    />
                    <span className="text-xs font-bold uppercase">{key}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Bottom Row: View Mode, Navigation & New Event Button */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* View Mode & Navigation */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                  {['day', 'week', 'month', 'agenda'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode as any)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        viewMode === mode
                          ? 'bg-white shadow-sm text-primary'
                          : 'hover:text-primary text-slate-600'
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="h-6 w-px bg-slate-200"></div>

                {/* Month Navigation */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={previousMonth}
                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-lg font-bold min-w-[140px] text-center">{monthName}</span>
                  <button
                    onClick={nextMonth}
                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                    aria-label="Next month"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <button
                    onClick={goToToday}
                    className="ml-2 px-3 py-1 border border-slate-200 rounded text-sm hover:bg-slate-50 transition-colors"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* New Event Button */}
              <button
                onClick={() => setShowNewEventModal(true)}
                className="w-full md:w-auto bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center md:justify-start space-x-2 hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                <span>New Event</span>
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto bg-slate-50 p-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-[700px]">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                  <div key={day} className="py-3 text-center text-xs font-bold text-slate-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 flex-1">
                {/* Previous month days */}
                {Array.from({ length: firstDay }).map((_, idx) => (
                  <div
                    key={`prev-${idx}`}
                    className="border-b border-r border-slate-100 p-2 min-h-[120px] bg-slate-50/30"
                  >
                    <span className="text-sm font-medium text-slate-400">
                      {getDaysInMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)) - firstDay + idx + 1}
                    </span>
                  </div>
                ))}

                {/* Current month days */}
                {days.map(day => {
                  const isToday =
                    new Date().getDate() === day &&
                    new Date().getMonth() === currentDate.getMonth() &&
                    new Date().getFullYear() === currentDate.getFullYear()
                  const dayEvents = getEventsForDate(day)

                  return (
                    <div
                      key={day}
                      className={`border-b border-r border-slate-100 p-2 min-h-[120px] ${
                        isToday ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''
                      }`}
                    >
                      <span
                        className={`text-sm font-medium ${
                          isToday
                            ? 'flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full font-bold'
                            : ''
                        }`}
                      >
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {dayEvents.map(event => (
                          <div
                            key={event.id}
                            onClick={() => setSelectedEvent(event)}
                            className={`px-2 py-1 text-[10px] rounded truncate font-medium border-l-2 cursor-pointer hover:shadow-sm transition-shadow ${
                              CATEGORY_COLORS[event.category]?.bg || 'bg-slate-50'
                            } ${CATEGORY_COLORS[event.category]?.text || 'text-slate-600'}`}
                          >
                            {!event.all_day && event.start_time && `${event.start_time} `}
                            {event.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Next month days */}
                {Array.from({
                  length: 42 - firstDay - daysInMonth
                }).map((_, idx) => (
                  <div key={`next-${idx}`} className="border-b border-r border-slate-100 p-2 min-h-[120px] bg-slate-50/30">
                    <span className="text-sm font-medium text-slate-400">{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-80 bg-slate-50 border-l border-slate-200 overflow-y-auto hidden 2xl:flex flex-col">
          <div className="p-6">
            {/* Mini Calendar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700">Jump to Date</h3>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                <div className="grid grid-cols-7 text-[10px] text-center font-bold text-slate-400 mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                    <div key={`weekday-${idx}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 text-xs text-center gap-1">
                  {Array.from({ length: 42 }, (_, i) => {
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i - firstDay + 1)
                    const isCurrentMonth = date.getMonth() === currentDate.getMonth()
                    const isToday = date.toDateString() === new Date().toDateString()

                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (isCurrentMonth) {
                            setCurrentDate(date)
                          }
                        }}
                        className={`py-1 rounded cursor-pointer transition-colors ${
                          !isCurrentMonth
                            ? 'text-slate-300'
                            : isToday
                            ? 'bg-primary text-white font-bold'
                            : 'hover:bg-slate-100'
                        }`}
                      >
                        {date.getDate()}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Upcoming Events */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-4">Upcoming Team Events</h3>
              <div className="space-y-4">
                {getUpcomingEvents().map(event => {
                  const eventDate = new Date(event.event_date)
                  const day = String(eventDate.getDate()).padStart(2, '0')
                  const month = eventDate.toLocaleString('default', { month: 'short' }).toUpperCase()

                  return (
                    <div
                      key={event.id}
                      className="flex space-x-4 p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded flex flex-col items-center justify-center font-bold text-xs ${
                          CATEGORY_COLORS[event.category]?.bg || 'bg-slate-50'
                        } ${CATEGORY_COLORS[event.category]?.text || 'text-slate-600'}`}
                      >
                        <span>{month}</span>
                        <span>{day}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{event.title}</p>
                        <p className="text-xs text-slate-500">
                          {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                          {event.start_time && ` • ${event.start_time}`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <button className="w-full mt-6 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg border border-dashed border-primary/40 transition-colors">
                View All Agenda
              </button>
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-auto p-6 bg-primary/5 border-t border-slate-200">
            <div className="flex items-center space-x-2 mb-2">
              <Info size={16} className="text-primary" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">Availability Insight</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sales team capacity is at 85% for next week. Consider scheduling overlapping demos carefully.
            </p>
          </div>
        </aside>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{selectedEvent.title}</h2>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Date</span>
                  <p className="text-sm font-medium">
                    {new Date(selectedEvent.event_date).toLocaleDateString()}
                  </p>
                </div>

                {selectedEvent.start_time && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase">Time</span>
                    <p className="text-sm font-medium">
                      {selectedEvent.start_time}
                      {selectedEvent.end_time && ` - ${selectedEvent.end_time}`}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Category</span>
                  <p className="text-sm font-medium">{selectedEvent.category}</p>
                </div>

                {selectedEvent.location && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase">Location</span>
                    <p className="text-sm font-medium">{selectedEvent.location}</p>
                  </div>
                )}

                {selectedEvent.description && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase">Description</span>
                    <p className="text-sm">{selectedEvent.description}</p>
                  </div>
                )}
              </div>

              {selectedEvent.created_by === user?.id && (
                <button
                  onClick={() => handleDeleteEvent(selectedEvent)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
                >
                  <Trash2 size={16} />
                  Delete Event
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Event Modal */}
      {showNewEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Create New Event</h2>
                <button
                  onClick={() => setShowNewEventModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Title *</label>
                  <input
                    type="text"
                    value={newEventData.title}
                    onChange={e => setNewEventData({ ...newEventData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Event title"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Date *</label>
                  <input
                    type="date"
                    value={newEventData.event_date}
                    onChange={e => setNewEventData({ ...newEventData, event_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* All Day Toggle */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="all_day"
                    checked={newEventData.all_day}
                    onChange={e => setNewEventData({ ...newEventData, all_day: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="all_day" className="ml-2 text-sm font-medium text-slate-700">
                    All Day Event
                  </label>
                </div>

                {/* Start Time */}
                {!newEventData.all_day && (
                  <div>
                    <label className="text-sm font-bold text-slate-700 block mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newEventData.start_time}
                      onChange={e => setNewEventData({ ...newEventData, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}

                {/* End Time */}
                {!newEventData.all_day && (
                  <div>
                    <label className="text-sm font-bold text-slate-700 block mb-1">End Time</label>
                    <input
                      type="time"
                      value={newEventData.end_time}
                      onChange={e => setNewEventData({ ...newEventData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}

                {/* Category */}
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Category *</label>
                  <select
                    value={newEventData.category}
                    onChange={e => setNewEventData({ ...newEventData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="general">General</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="finance">Finance</option>
                    <option value="sales">Sales</option>
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Location</label>
                  <input
                    type="text"
                    value={newEventData.location}
                    onChange={e => setNewEventData({ ...newEventData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Event location"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1">Description</label>
                  <textarea
                    value={newEventData.description}
                    onChange={e => setNewEventData({ ...newEventData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Event description"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewEventModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEvent}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
