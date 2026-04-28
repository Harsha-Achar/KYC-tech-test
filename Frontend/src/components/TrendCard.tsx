import { TrendingUp } from 'lucide-react'

export function TrendCard({
  label,
  value,
  delta,
}: {
  label: string
  value: string
  delta?: string
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted">{label}</p>
        <TrendingUp className="size-4 text-secondary" />
      </div>
      <p className="mt-2 text-lg font-semibold text-gray-900">{value}</p>
      {delta ? <p className="mt-1 text-xs text-success">{delta}</p> : null}
    </div>
  )
}
