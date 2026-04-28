import { FileText } from 'lucide-react'

export function FilePreviewCard({ fileName }: { fileName: string }) {
  const Icon = FileText
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-sm">
      <div className="flex size-12 items-center justify-center rounded-lg bg-gray-100 text-primary">
        <Icon className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{fileName}</p>
        <p className="text-xs text-muted">Integration guide document</p>
      </div>
    </div>
  )
}
