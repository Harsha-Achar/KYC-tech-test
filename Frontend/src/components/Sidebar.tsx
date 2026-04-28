import { NavLink } from 'react-router-dom'
import { LayoutDashboard, AlertTriangle, Bot, Upload, FileText, Scale } from 'lucide-react'


const adminNav = [
  { to: '/', label: 'Overview Dashboard', icon: LayoutDashboard },
  { to: '/issues', label: 'Issue Monitor', icon: AlertTriangle },
  { to: '/issue-insights', label: 'Issue Insights', icon: FileText },
  { to: '/ai', label: 'Client Chat History', icon: Bot },
  { to: '/uploads', label: 'Upload Center', icon: Upload },
]

const clientNav = [
  { to: '/', label: 'Client History & Chatbot', icon: Bot },
  { to: '/compatibility', label: 'Compatibility', icon: Scale }, // ✅ ONLY HERE
]
export function Sidebar({
  role,
  open,
  onClose,
}: {
  role: 'admin' | 'client'
  open: boolean
  onClose: () => void
}) {
  const nav = role === 'client' ? clientNav : adminNav

  return (
    <>
      {/* 🔲 Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        onClick={onClose}
        aria-hidden
      />

      {/* 🔳 Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col
  bg-[#F7F3F0]
  border-r border-[#E5D6CC]
  transition-transform
  lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* 🔷 Header */}
        <div className="sticky top-0 z-30 flex h-16 items-center border-b border-gray-200 bg-gradient-to-r from-[#4B1F0F] via-[#6A2E17] to-[#7A3F1D] px-4">

          <div className="ml-15 leading-tight">
            <p className="text-sm font-medium text-white">
              JPMC
            </p>
            <p className="text-[11px] text-white">
              API Intelligence
            </p>
          </div>
        </div>

        {/* 🔷 Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive
                  ? 'border border-black bg-white/40'
                  : 'text-gray-700 hover:bg-white/30 hover:text-gray-900'
                }`
              }
            >
              <Icon className="size-4 transition-transform group-hover:scale-110" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}