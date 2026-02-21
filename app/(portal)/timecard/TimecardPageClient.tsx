'use client'

import { useState, useEffect } from 'react'
import { 
  Play, 
  Square, 
  CheckCircle2, 
  Clock, 
  Briefcase, 
  MapPin, 
  FolderOpen, 
  FileText,
  Timer
} from 'lucide-react'

export default function TimecardPage() {
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isClockedIn && startTime) {
      interval = setInterval(() => {
        const now = new Date()
        const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        setElapsedTime(diff)
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [isClockedIn, startTime])

  const formatElapsedTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleStartShift = () => {
    setIsClockedIn(true)
    setStartTime(new Date())
    setElapsedTime(0)
  }

  const handleEndShift = () => {
    setIsClockedIn(false)
    setStartTime(null)
    setElapsedTime(0)
  }

  return (
    <div className="flex-1 bg-gray-50 h-full overflow-y-auto">
      {/* 1️⃣ Purple Hero Header Section */}
      <div className="bg-gradient-to-r from-[#1e1b4b] via-[#312e81] to-[#4338ca] text-white py-12 px-8 shadow-md relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

        <div className="max-w-[1600px] mx-auto relative z-10 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">Timecard</h1>
            <p className="text-indigo-200 text-lg font-light tracking-wide">
              Track, log, and manage work hours across all projects
            </p>
          </div>
          
          {isClockedIn && (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-medium text-emerald-100 tracking-wide uppercase">Time Running</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-8 space-y-8 -mt-8 relative z-20">
        
        {/* 2️⃣ Active Session Card (Premium Style) */}
        {isClockedIn ? (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-600 to-indigo-600"></div>
            
            <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left: Timer & Status */}
              <div className="lg:col-span-4 space-y-4">
                <div className="flex items-center gap-3 text-purple-600 mb-1">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Timer className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold tracking-widest uppercase">Active Session</span>
                </div>
                
                <div>
                  <div className="text-7xl font-mono font-bold text-gray-900 tracking-tighter tabular-nums leading-none">
                    {formatElapsedTime(elapsedTime)}
                  </div>
                  <div className="text-sm text-gray-400 font-medium mt-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Started at {startTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Middle: Session Details Grid */}
              <div className="lg:col-span-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                  <div className="group">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 group-hover:text-purple-600 transition-colors">Client</div>
                    <div className="font-semibold text-gray-800 text-lg">Acme Corp</div>
                  </div>
                  <div className="group">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 group-hover:text-purple-600 transition-colors">Location</div>
                    <div className="font-semibold text-gray-800 text-lg flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      Sydney HQ
                    </div>
                  </div>
                  <div className="group">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 group-hover:text-purple-600 transition-colors">Work Type</div>
                    <div className="font-semibold text-gray-800 text-lg">Development</div>
                  </div>
                  <div className="group">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 group-hover:text-purple-600 transition-colors">Task</div>
                    <div className="font-semibold text-gray-800 text-lg">Frontend Implementation</div>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="lg:col-span-2 flex flex-col gap-3 justify-end items-end h-full border-l border-gray-100 pl-8">
                <button 
                  onClick={handleEndShift}
                  className="w-full py-3 px-6 bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white rounded-xl shadow-sm transition-all duration-200 font-semibold flex items-center justify-center gap-2 group"
                >
                  <Square className="w-4 h-4 fill-current group-hover:fill-white transition-colors" />
                  Stop Work
                </button>
                <button 
                  className="w-full py-3 px-6 bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 rounded-xl shadow-sm transition-all duration-200 font-semibold flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Complete
                </button>
              </div>
            </div>
            
            {/* Progress Bar Loader (Visual flair) */}
            <div className="h-1 w-full bg-gray-50">
              <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 w-1/3 animate-[pulse_3s_ease-in-out_infinite]"></div>
            </div>
          </div>
        ) : (
          /* 3️⃣ Work in Progress Section (New Entry) */
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
              <div className="bg-indigo-50 p-2.5 rounded-lg text-indigo-600">
                <Play className="w-5 h-5 fill-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Start New Session</h2>
                <p className="text-gray-500 text-sm">Select project details to begin tracking time</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5" /> Client
                  </label>
                  <div className="relative">
                    <select className="w-full pl-4 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer hover:bg-gray-100/50">
                      <option>Select Client...</option>
                      <option>Acme Corp</option>
                      <option>NBE Internal</option>
                      <option>Global Industries</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" /> Location
                  </label>
                  <div className="relative">
                    <select className="w-full pl-4 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer hover:bg-gray-100/50">
                      <option>Select Location...</option>
                      <option>Sydney HQ</option>
                      <option>Melbourne Branch</option>
                      <option>Remote / WFH</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5" /> Work Type
                  </label>
                  <div className="relative">
                    <select className="w-full pl-4 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer hover:bg-gray-100/50">
                      <option>Select Work Type...</option>
                      <option>Development</option>
                      <option>Design</option>
                      <option>Meeting</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> Task
                  </label>
                  <div className="relative">
                    <select className="w-full pl-4 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer hover:bg-gray-100/50">
                      <option>Select Task...</option>
                      <option>General Work</option>
                      <option>Code Review</option>
                      <option>Planning</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-end">
              <button 
                onClick={handleStartShift}
                className="px-10 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-purple-500/30 font-bold text-lg tracking-wide transition-all duration-200 transform hover:-translate-y-0.5"
              >
                Start Work
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
