import type { ReactNode } from 'react'
import { Lightbulb } from 'lucide-react'

export function InsightPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Lightbulb className="size-4 shrink-0" />
        {title}
      </div>
      <div className="text-sm text-amber-950/90">{children}</div>
    </div>
  )
}
