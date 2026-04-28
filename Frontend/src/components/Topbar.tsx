import { Bell, Menu, Search } from 'lucide-react'
import { useState } from 'react'
import { userProfile } from '../data/userProfile'
// import { userProfile } from '../data/userProfile'


export function Topbar({
  onMenu,
  onLogout,
  onSwitchRole,
  role,
  showMenu = true,
}: {
  onMenu: () => void
  onLogout?: () => void
  onSwitchRole?: () => void
  role: 'admin' | 'client'
  showMenu?: boolean
}) {
  const [q, setQ] = useState('')
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-gray-200 bg-gradient-to-r from-[#7A3F1D] via-[#9C5A2F] to-[#B97A52] px-4 shadow-small">

      {/* LEFT: Menu */}
      <div className="flex items-center gap-2">
        {showMenu && (
          <button
            type="button"
            onClick={onMenu}
            className="rounded-lg p-2 text-black-600 hover:bg-gray-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
        )}
      </div>

      {/* CENTER: Search (properly aligned) */}
      <div className="flex flex-1 justify-center px-4">
        <div className="relative w-full max-w-md">
          {/* <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black-400" /> */}

          {/* <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients, issues, KB..."
            className="w-full rounded-lg  bg-gray-50 py-2 pl-10 pr-10 text-sm font-medium outline-none transition focus:bg-white"
          /> */}

          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: Actions */}
      <div className="flex items-center gap-2">
        {/* Role Switch */}
        {/* {onSwitchRole && (
          <button
            onClick={onSwitchRole}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {role === 'admin' ? 'Client' : 'Admin'}
          </button>
        )} */}

        {/* RIGHT: Actions */}
        <div className="flex items-center gap-3">

          <button
            onClick={onSwitchRole}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm font-medium text-white cursor-pointer"
          >
            {role === 'admin' ? 'Switch to Client' : 'Switch to Admin'}
          </button>

          {/* Notifications */}
          <button className="relative rounded-lg p-2 text-white cursor-pointer">
            <Bell className="size-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {/* USER DROPDOWN */}
          <div className="relative group">

            {/* Avatar Button */}
            <div className="flex items-center gap-2 rounded-lg px-2 py-1 cursor-pointer ">

              {/* Avatar */}
              {userProfile.avatar &&
                userProfile.avatar !== '[PLACEHOLDER — Replace with actual logo URL when available]' ? (
                <img
                  src={userProfile.avatar}
                  alt={userProfile.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full 
bg-gradient-to-br from-[#9C5A2F] to-[#7A3F1D] 
text-white text-sm font-semibold shadow-md">
                  {userProfile.name?.charAt(0)}
                </div>
              )}

              {/* Name */}
              <span className="hidden sm:block text-sm font-medium font-medium text-white">
                {userProfile.name}
              </span>
            </div>







            <div className="invisible absolute right-0 mt-3 w-48 rounded-xl bg-white shadow-lg opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">

              {/* 🔺 Small subtle triangle */}
              <div className="absolute -top-1.5 right-4 h-2.5 w-2.5 rotate-45 bg-white border-l border-t border-gray-200"></div>

              {/* Content */}
              <div className="px-4 py-3">
                <p className="text-sm font-medium font-semibold text-gray-800">
                  {userProfile.name}
                </p>
                <p className="text-sm font-medium text-gray-500">
                  {userProfile.email}
                </p>
              </div>

              {/* Logout */}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 rounded-b-xl"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </header >
  )
}