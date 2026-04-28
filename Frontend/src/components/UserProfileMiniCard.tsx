import type { UserProfile } from '../types'
import { formatShortDate } from '../utils/formatters'

export function UserProfileMiniCard({ profile }: { profile: UserProfile }) {
  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white/90 p-3 shadow-sm">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary text-white">
        <span className="text-xs font-bold tracking-wide">{initials || 'SA'}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{profile.name}</p>
        <p className="truncate text-[10px] text-muted">Login {formatShortDate(profile.lastLogin)}</p>
      </div>
    </div>
  )
}
