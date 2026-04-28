import { confidenceBarColor, confidenceLabel } from '../utils/confidence'

export function ConfidenceIndicator({
  percentage,
  showLabel = true,
}: {
  percentage: number
  showLabel?: boolean
}) {
  const label = confidenceLabel(percentage)
  const bar = confidenceBarColor(percentage)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">Confidence</span>
        {showLabel ? (
          <span
            className={
              label === 'High'
                ? 'text-success'
                : label === 'Medium'
                  ? 'text-warning'
                  : 'text-danger'
            }
          >
            {label}
          </span>
        ) : null}
        <span className="font-semibold text-gray-900">{percentage}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}
