import type { ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'

type ChartCardProps = {
  title: string
  subtitle?: string
  children: ReactNode
  legend?: ReactNode
  filterMenu?: boolean
}

export function ChartCard({ title, subtitle, children, legend, filterMenu }: ChartCardProps) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-small font-semibold ">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs">{subtitle}</p> : null}
        </div>
        {filterMenu ? (
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted transition hover:bg-gray-100 hover:text-gray-800"
            aria-label="Chart options"
          >
            <MoreHorizontal className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="min-h-[220px] w-full">{children}</div>
      {legend ? <div className="mt-3 flex flex-wrap gap-3 border-t border-[#E5E7EB] pt-3">{legend}</div> : null}
    </div>
  )
}