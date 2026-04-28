import type { ReactNode } from 'react'

type FilterBarProps = {
  children: ReactNode
  chips?: ReactNode
}

export function FilterBar({ children, chips }: FilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">{children}</div>
      {chips ? <div className="flex flex-wrap gap-2">{chips}</div> : null}
    </div>
  )
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-medium text-gray-700">
      {label}
      {children}
    </label>
  )
}
