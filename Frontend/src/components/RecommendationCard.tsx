import type { ReactNode } from 'react'

export function RecommendationCard({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-secondary/30 bg-sky-50/50 p-4">
      <h4 className="text-sm font-semibold text-primary">{title}</h4>
      <div className="mt-2 text-sm text-gray-800">{children}</div>
      {footer ? <div className="mt-3 border-t border-sky-200 pt-2 text-xs text-muted">{footer}</div> : null}
    </div>
  )
}
