export function HealthScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-danger'
  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-gray-800">{score}</span>
    </div>
  )
}
