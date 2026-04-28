import { Upload } from 'lucide-react'

export function FileUploadDropzone({
  label = 'Drag and drop files here, or click to browse',
}: {
  label?: string
}) {
  return (
    <button
      type="button"
      className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E5E7EB] bg-gray-50/80 px-6 py-12 text-center transition hover:border-primary hover:bg-primary/[0.04]"
    >
      <Upload className="mb-2 size-8 text-secondary" />
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <span className="mt-1 text-xs text-muted">Mock UI — no files are uploaded</span>
    </button>
  )
}
