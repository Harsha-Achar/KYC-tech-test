import type { ReactNode } from 'react'

export type TabItem = { id: string; label: string; content: ReactNode }

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
}) {
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-[#E5E7EB]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`relative px-3 py-2 text-sm font-medium transition ${
              active === t.id ? 'text-primary' : 'text-muted hover:text-gray-800'
            }`}
          >
            {t.label}
            {active === t.id ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            ) : null}
          </button>
        ))}
      </div>
      <div className="pt-4">{current?.content}</div>
    </div>
  )
}
