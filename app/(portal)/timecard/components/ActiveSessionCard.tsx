'use client'

import { useEffect, useState } from 'react'
import { StopCircle, CheckCircle } from 'lucide-react'

interface ActiveSession {
  id: string
  client: string
  location: string
  workType: string
  task: string
  startTime: string
}

interface ActiveSessionCardProps {
  session: ActiveSession
  onStop: () => Promise<void>
  onComplete: () => Promise<void>
}

export function ActiveSessionCard({ session, onStop, onComplete }: ActiveSessionCardProps) {
  const [elapsedTime, setElapsedTime] = useState('00:00:00')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const start = new Date(session.startTime).getTime()
      const now = Date.now()
      const diff = Math.max(0, now - start)
      
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)

      setElapsedTime(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [session.startTime])

  const handleStop = async () => {
    setIsProcessing(true)
    try {
      await onStop()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleComplete = async () => {
    setIsProcessing(true)
    try {
      await onComplete()
    } finally {
      setIsProcessing(false)
    }
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />

      <div className="p-6 lg:p-8 pl-8 lg:pl-10">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
          
          {/* Left: Timer */}
          <div className="flex-shrink-0 space-y-2 text-center lg:text-left min-w-[200px]">
            <div className="text-xs uppercase tracking-wider font-semibold text-indigo-600">
              Active Session
            </div>
            <div className="text-5xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
              {elapsedTime}
            </div>
            <div className="text-sm text-slate-500">
              Started at {formatTime(session.startTime)}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-24 bg-slate-200" />

          {/* Center: Session Info */}
          <div className="flex-grow grid grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Client</div>
              <div className="text-base font-medium text-slate-900">{session.client}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Location</div>
              <div className="text-base font-medium text-slate-900">{session.location}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Work Type</div>
              <div className="text-base font-medium text-slate-900">{session.workType}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Task</div>
              <div className="text-base font-medium text-slate-900">{session.task}</div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex-shrink-0 flex flex-col gap-3 w-full lg:w-48">
            <button
              onClick={handleStop}
              disabled={isProcessing}
              className="w-full h-11 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-all duration-200 ease-in-out hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <StopCircle size={18} />
              Stop Work
            </button>
            <button
              onClick={handleComplete}
              disabled={isProcessing}
              className="w-full h-11 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              Complete
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
