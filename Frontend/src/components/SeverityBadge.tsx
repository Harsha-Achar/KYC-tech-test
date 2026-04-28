import type { Severity } from '../types'

const map: Record<Severity, string> = {
  Low: 'bg-gray-100 text-gray-700 ring-gray-200',
  Medium: 'bg-amber-50 text-warning ring-amber-200',
  High: 'bg-orange-50 text-orange-800 ring-orange-200',
  Critical: 'bg-red-50 text-danger ring-red-200',
}

export function SeverityBadge({ severity }: { severity: Severity | string }) {
  const cls = map[severity as Severity] ?? 'bg-gray-100 text-gray-700 ring-gray-200'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}
    >
      {severity}
    </span>
  )
}
