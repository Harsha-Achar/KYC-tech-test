import { formatShortDate } from '../utils/formatters'

export type TimelineEvent = {
  id: string
  label: string
  at: string
  detail?: string
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative border-l border-[#E5E7EB] pl-6">
      {events.map((e) => (
        <li key={e.id} className="mb-6 last:mb-0">
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-white bg-primary" />
          <p className="text-sm font-semibold text-gray-900">{e.label}</p>
          <p className="text-xs text-muted">{formatShortDate(e.at)}</p>
          {e.detail ? <p className="mt-1 text-sm text-gray-700">{e.detail}</p> : null}
        </li>
      ))}
    </ol>
  )
}
