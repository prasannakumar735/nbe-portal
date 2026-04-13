'use client'

import { UserDropdown } from './UserDropdown'

interface HeaderProps {
  user: any
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="relative z-50 flex h-14 shrink-0 items-center justify-between overflow-visible border-b border-slate-200 bg-white px-4">
      <div className="flex max-w-md flex-1 items-center">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
            search
          </span>
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          aria-label="Notifications"
          className="relative p-2 text-slate-500 transition-colors hover:text-indigo-600"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
        </button>

        <div className="h-8 w-px bg-slate-200" />

        <UserDropdown user={user} />
      </div>
    </header>
  )
}
