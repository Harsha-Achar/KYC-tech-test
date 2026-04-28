import type { ReactNode } from 'react'

type MetricCardProps = {
  label: string
  value: ReactNode
  hint?: string
  trend?: string
  tooltip?: string
}

export function MetricCard({ label, value, hint, trend, tooltip }: MetricCardProps) {
  return (
    <div
      className="h-full rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md hover:border-black md:p-5"
      title={tooltip}
    >
      {/* LABEL */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-900">
        {label}
      </p>

      {/* VALUE */}
      <p className="mt-2 text-2xl font-semibold text-gray-900">
        {value}
      </p>

      {/* OPTIONAL */}
      {hint ? (
        <p className="mt-1 text-xs text-gray-600">{hint}</p>
      ) : null}

      {trend ? (
        <p className="mt-2 text-xs font-medium text-gray-700">
          {trend}
        </p>
      ) : null}
    </div>
  )
}