import { formatShortDate } from '../utils/formatters'

export type ActivityItem = {
  id: string
  label: string
  time: string
  type?: 'issue' | 'health' | 'upload' | 'escalation' | 'kb'
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li
          key={a.id}
          className="flex gap-3 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm shadow-sm"
        >
          <span className="mt-0.5 size-2 shrink-0 rounded-full bg-secondary" />
          <div className="min-w-0 flex-1">
            <p className="text-gray-900">{a.label}</p>
            <p className="text-xs text-muted">{formatShortDate(a.time)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
