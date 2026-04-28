type LoadingSkeletonProps = {
  className?: string
  lines?: number
}

export function LoadingSkeleton({ className = '', lines = 1 }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-gray-200" style={{ width: `${85 - i * 10}%` }} />
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-white p-5">
      <div className="mb-3 h-4 w-1/3 rounded bg-gray-200" />
      <div className="h-8 w-2/3 rounded bg-gray-200" />
      <div className="mt-4 h-3 w-full rounded bg-gray-100" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-white p-5">
      <div className="mb-4 h-4 w-1/2 rounded bg-gray-200" />
      <div className="h-56 w-full rounded-lg bg-gray-100" />
    </div>
  )
}
