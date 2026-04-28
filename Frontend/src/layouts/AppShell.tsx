import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { Topbar } from '../components/Topbar'

export function AppShell({
  role,
  onLogout,
  onSwitchRole,
}: {
  role: 'admin' | 'client'
  onLogout: () => void
  onSwitchRole: () => void
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isAdmin = role === 'admin'
  return (
    <div className={`flex bg-surface ${isAdmin ? 'min-h-screen' : 'h-screen overflow-hidden'}`}>
      {isAdmin ? <Sidebar role={role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} /> : null}
      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <Topbar
          onMenu={() => setSidebarOpen(true)}
          onLogout={onLogout}
          onSwitchRole={onSwitchRole}
          role={role}
          showMenu={isAdmin}
        />
        <main className="flex-1 overflow-auto p-3">         <Outlet />
        </main>
        {/* <footer className="border-t border-[#E5E7EB] bg-white px-6 py-3 text-center text-xs text-muted lg:text-left">
          Affine Analytics — Affine TechSpec v1.0 · Logo URL: [PLACEHOLDER — Replace with actual logo URL when
          available]
        </footer> */}
      </div>
    </div>
  )
}