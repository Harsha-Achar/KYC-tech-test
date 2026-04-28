import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export function AccordionItem({
  title,
  children,
  defaultOpen,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="border-b border-[#E5E7EB] last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-3 text-left text-sm font-semibold text-gray-900"
      >
        {title}
        <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="pb-3 text-sm text-muted">{children}</div> : null}
    </div>
  )
}

export function Accordion({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-white px-4">{children}</div>
}
