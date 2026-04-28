import type { IntegrationStatus } from '../types'

const styles: Record<IntegrationStatus, string> = {
  Successful: 'bg-emerald-50 text-success ring-1 ring-emerald-200',
  'In Progress': 'bg-sky-50 text-secondary ring-1 ring-sky-200',
  Failed: 'bg-red-50 text-danger ring-1 ring-red-200',
  'Facing Issues': 'bg-amber-50 text-warning ring-1 ring-amber-200',
  Resolved: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
  Escalated: 'bg-violet-50 text-violet-800 ring-1 ring-violet-200',
}

export function StatusBadge({ status }: { status: IntegrationStatus | string }) {
  const key = status as IntegrationStatus
  const cls = styles[key] ?? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}
