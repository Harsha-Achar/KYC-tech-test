import { ShieldAlert } from 'lucide-react'

export function ComplianceBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
      <div>
        <p className="text-sm font-medium">Compliance notice</p>
        <p className="mt-1 text-amber-900/90">{message}</p>
      </div>
    </div>
  )
}