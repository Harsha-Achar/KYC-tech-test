import { ArrowDownUp } from 'lucide-react'

type SortableHeaderProps = {
  label: string
  active?: boolean
  direction?: 'asc' | 'desc'
  onClick?: () => void
}

export function SortableHeader({ label, active, direction, onClick }: SortableHeaderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 hover:text-primary"
    >
      {label}
      <ArrowDownUp
        className={`size-3.5 shrink-0 transition ${active ? 'text-primary' : 'text-gray-300 group-hover:text-gray-400'}`}
      />
      {active ? <span className="sr-only">{direction}</span> : null}
    </button>
  )
}
