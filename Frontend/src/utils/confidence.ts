export type ConfidenceLabel = 'High' | 'Medium' | 'Low'

export function confidenceLabel(pct: number): ConfidenceLabel {
  if (pct >= 80) return 'High'
  if (pct >= 55) return 'Medium'
  return 'Low'
}

export function confidenceColor(pct: number): string {
  if (pct >= 80) return 'text-success'
  if (pct >= 55) return 'text-warning'
  return 'text-danger'
}

export function confidenceBarColor(pct: number): string {
  if (pct >= 80) return 'bg-success'
  if (pct >= 55) return 'bg-warning'
  return 'bg-danger'
}
