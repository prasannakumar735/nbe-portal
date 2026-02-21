'use client'

import { useState, useEffect } from 'react'
import {
  Clock,
  MapPin,
  Calendar,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Navigation,
  History,
  AlertTriangle
} from 'lucide-react'

export default function TimecardDashboard() {
  const [time, setTime] = useState(new Date())
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [shiftStartTime, setShiftStartTime] = useState<Date | null>(null)

  // Real-time clock effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // GPS Handler
  const handleToggleShift = () => {
    if (isClockedIn) {
      // End Shift
      setIsClockedIn(false)
      setShiftStartTime(null)
      setLocation(null)
      console.log('Shift ended at:', new Date())
    } else {
      // Start Shift
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            })
            setIsClockedIn(true)
            setShiftStartTime(new Date())
            console.log('Shift started at:', new Date(), 'Location:', position.coords)
          },
          (error) => {
            setLocationError('Unable to retrieve location. Please enable GPS.')
            console.error('GPS Error:', error)
          }
        )
      } else {
        setLocationError('Geolocation is not supported by your browser.')
      }
    }
  }

  // Formatting helpers
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto">
      {/* Premium Purple Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white pb-24 pt-12 px-8 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500 opacity-10 rounded-full -ml-24 -mb-24 blur-2xl"></div>
        
        <div className="max-w-[1600px] mx-auto relative z-10">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 text-purple-200 text-sm font-medium mb-2">
                <span>NBE Portal</span>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400/50"></span>
                <span>Workforce Management</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Timecard & GPS Tracking</h1>
              <p className="text-purple-200 max-w-xl">
                Real-time attendance monitoring with verified GPS location services.
                Clock in/out to automatically log your hours and location.
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 shadow-sm">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-medium text-emerald-100">System Online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 -mt-16 pb-12 relative z-20 space-y-8">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Clock Card (4 cols) */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2 text-gray-700 font-semibold">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <span>Time Clock</span>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${isClockedIn ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                  {isClockedIn ? 'Clocked In' : 'Not Clocked In'}
                </div>
              </div>
              
              <div className="p-8 flex flex-col items-center justify-center flex-1 space-y-8">
                {/* Digital Clock */}
                <div className="text-center space-y-1 relative">
                  <div className="text-6xl font-black text-gray-900 tracking-tight tabular-nums relative z-10">
                    {formatTime(time).split(' ')[0]}
                  </div>
                  <div className="text-xl font-medium text-purple-600 uppercase tracking-widest">
                    {formatTime(time).split(' ')[1]}
                  </div>
                  <div className="text-sm text-gray-400 font-medium pt-2">
                    {formatDate(time)}
                  </div>
                </div>

                {/* Main Action Button */}
                <div className="w-full max-w-xs relative">
                  {/* Pulse effect behind button when active */}
                  {isClockedIn && (
                    <div className="absolute inset-0 bg-red-500 rounded-lg blur opacity-20 animate-pulse"></div>
                  )}
                  
                  <button
                    onClick={handleToggleShift}
                    className={`w-full relative py-4 px-6 rounded-lg font-bold text-lg shadow-md transition-all duration-200 transform active:scale-[0.98] flex items-center justify-center gap-3 ${
                      isClockedIn 
                        ? 'bg-white border-2 border-red-500 text-red-600 hover:bg-red-50' 
                        : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-lg border-2 border-transparent'
                    }`}
                  >
                    {isClockedIn ? (
                      <>
                        <XCircle className="w-6 h-6" />
                        End Shift
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-6 h-6" />
                        Start Shift
                      </>
                    )}
                  </button>
                  
                  <div className="text-center mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                    <MapPin className="w-3 h-3" />
                    <span>GPS location required to {isClockedIn ? 'end' : 'start'} shift</span>
                  </div>
                  
                  {locationError && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 flex gap-2 items-start">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {locationError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Location Card (8 cols) */}
          <div className="lg:col-span-8 flex flex-col">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col h-full min-h-[400px]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2 text-gray-700 font-semibold">
                  <Navigation className="w-5 h-5 text-purple-600" />
                  <span>Current Location</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-medium">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  High Accuracy GPS
                </div>
              </div>
              
              <div className="flex-1 bg-slate-100 relative group overflow-hidden">
                {/* Map Placeholder Pattern */}
                <div 
                  className="absolute inset-0 opacity-40 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] bg-cover bg-center grayscale mix-blend-multiply"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-200/50 to-transparent pointer-events-none"></div>

                {/* Animated Map Marker */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className="relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <div className="relative bg-purple-600 text-white p-3 rounded-full shadow-xl border-4 border-white">
                      <MapPin className="w-6 h-6" />
                    </div>
                  </div>
                  {/* Tooltip/Label */}
                  <div className="mt-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-gray-800 border border-gray-200 transform transition-all group-hover:-translate-y-1">
                    {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Waiting for GPS signal...'}
                  </div>
                </div>

                {/* Overlay Card: Address */}
                <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur shadow-lg rounded-xl p-4 border border-gray-200 max-w-sm">
                  <div className="flex gap-3 items-start">
                    <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                      <Navigation className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Current Job Site</h4>
                      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
                        123 Business Parkway, Suite 400<br />
                        New York, NY 10001
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-2 py-1 rounded">
                          Zone ID: NY-8842
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Timesheet Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
            <div className="flex items-center gap-4">
              <div className="bg-white p-2.5 rounded-lg shadow-sm border border-gray-200 text-purple-600">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Weekly Timesheet</h3>
                <p className="text-sm text-gray-500">Feb 19 - Feb 25, 2026</p>
              </div>
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                Current Pay Period
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-all text-nowrap">
                <AlertCircle className="w-4 h-4" />
                <span>Correction Request</span>
              </button>
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-purple-700 shadow-sm transition-all text-nowrap">
                <Download className="w-4 h-4" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200">
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Date</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/6">Clock In</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/6">Clock Out</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/6">Total Hours</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">GPS Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { date: 'Feb 24, 2026', in: '08:58 AM', out: '05:02 PM', total: '8h 04m', status: 'verified' },
                  { date: 'Feb 23, 2026', in: '09:00 AM', out: '05:30 PM', total: '8h 30m', status: 'verified' },
                  { date: 'Feb 22, 2026', in: '08:45 AM', out: '04:45 PM', total: '8h 00m', status: 'verified' },
                  { date: 'Feb 21, 2026', in: '09:12 AM', out: '05:15 PM', total: '8h 03m', status: 'offsite' },
                  { date: 'Feb 20, 2026', in: '--:--', out: '--:--', total: '--', status: 'pending' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${row.status === 'pending' ? 'bg-gray-300' : 'bg-purple-500'}`}></div>
                        <span className="text-sm font-medium text-gray-900">{row.date}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600 font-mono tracking-tight">{row.in}</td>
                    <td className="py-4 px-6 text-sm text-gray-600 font-mono tracking-tight">{row.out}</td>
                    <td className="py-4 px-6 text-sm font-bold text-gray-900 font-mono">{row.total}</td>
                    <td className="py-4 px-6">
                      {row.status === 'verified' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          GPS Verified
                        </span>
                      )}
                      {row.status === 'offsite' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Off-site
                        </span>
                      )}
                      {row.status === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          <History className="w-3.5 h-3.5" />
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 border-t border-gray-200 p-4 px-6 flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">Showing latest 5 records</span>
            <div className="flex gap-6 items-center">
              <span className="text-gray-600">Week Total:</span>
              <span className="text-xl font-black text-gray-900 tracking-tight">32h 37m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
