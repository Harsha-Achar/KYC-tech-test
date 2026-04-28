import type { ReactNode } from 'react'

export function SectionCard({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm md:p-5 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-20">
        <h2 className="text-small font-semibold text--900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}