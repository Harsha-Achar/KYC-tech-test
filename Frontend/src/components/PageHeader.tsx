import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Breadcrumb = { label: string; to?: string }

type PageHeaderProps = {
  title: string
  subtitle?: string
  breadcrumbs?: Breadcrumb[]
  actions?: ReactNode
  meta?: ReactNode
}

export function PageHeader({ title, subtitle, breadcrumbs, actions, meta }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-[#00000] pb-6 lg:flex-row lg:items-start lg:justify-between">
      <div>
        {breadcrumbs?.length ? (
          <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted">
            {breadcrumbs.map((b, i) => (
              <span key={b.label} className="flex items-center gap-1">
                {i > 0 ? <span className="text-gray-300">/</span> : null}
                {b.to ? (
                  <Link to={b.to} className="hover:text-primary">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-gray-600">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p> : null}
        {meta ? <div className="mt-3">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}