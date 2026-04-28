import { useRef, useState } from 'react'
import { Paperclip, Send, X, FileText } from 'lucide-react'
 
export function ChatComposer({
  onSend,
  disabled,
}: {
  onSend?: (payload: { text: string; attachments: File[] }) => void
  disabled?: boolean
}) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [previews, setPreviews] = useState<{ url: string; isImage: boolean }[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
 
  const canSend = !!text.trim() || attachments.length > 0
 
  function handleFiles(files: File[]) {
    setAttachments(files)
 
    const built = files.map((file) => ({
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      isImage: file.type.startsWith('image/'),
    }))
 
    setPreviews(built)
  }
 
  function removeAttachment(index: number) {
    const next = attachments.filter((_, i) => i !== index)
    const nextPreviews = previews.filter((_, i) => i !== index)
 
    if (previews[index]?.isImage && previews[index].url) {
      URL.revokeObjectURL(previews[index].url)
    }
 
    setAttachments(next)
    setPreviews(nextPreviews)
 
    if (next.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
 
  function handleSend() {
    onSend?.({ text, attachments })
 
    previews.forEach((p) => {
      if (p.isImage && p.url) URL.revokeObjectURL(p.url)
    })
 
    setText('')
    setAttachments([])
    setPreviews([])
 
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
 
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
 
      {/* ✅ Attachment preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] px-3 py-2">
          {attachments.map((file, i) => (
            <div
              key={i}
              className="relative flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-gray-50 p-1 pr-1.5"
            >
              {previews[i]?.isImage && previews[i].url ? (
                <div className="relative size-12 overflow-hidden rounded-md border border-[#E5E7EB]">
                  <img
                    src={previews[i].url}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex size-12 items-center justify-center rounded-md border border-[#E5E7EB] bg-gray-100">
                  <FileText className="size-5 text-gray-400" />
                </div>
              )}
 
              <div className="flex max-w-[120px] flex-col">
                <p className="truncate text-[11px] font-medium text-gray-700">
                  {file.name}
                </p>
                <p className="text-[10px] text-gray-400">
                  {file.size < 1024
                    ? `${file.size} B`
                    : file.size < 1024 * 1024
                      ? `${(file.size / 1024).toFixed(1)} KB`
                      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                </p>
              </div>
 
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="ml-1 flex size-4 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
 
      {/* ✅ Input area */}
      <div className="flex items-center gap-2 p-2">
 
        {/* Hidden input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            handleFiles(files)
          }}
        />
 
        {/* Attach button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
        >
          <Paperclip className="size-4" />
        </button>
 
        {/* Input */}
        <input
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe the issue..."
          className="flex-1 bg-transparent px-2 text-sm outline-none"
        />
 
        {/* Send */}
        <button
          type="button"
          disabled={disabled || !canSend}
          onClick={handleSend}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-[#4B1F0F] via-[#6A2E17] to-[#7A3F1D] text-white transition hover:opacity-90 disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="size-4" />
        </button>
 
      </div>
    </div>
  )
}
 