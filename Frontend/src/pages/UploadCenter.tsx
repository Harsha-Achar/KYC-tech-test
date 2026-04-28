import { useEffect, useRef, useState } from 'react'
import { DataTable, type Column } from '../components/DataTable'
import { SectionCard } from '../components/SectionCard'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { formatShortDate } from '../utils/formatters'
import type { UploadAsset } from '../types'

function statusClass(s: UploadAsset['status']): string {
  const map: Record<UploadAsset['status'], string> = {
    Uploaded: 'bg-green-100 text-green-700',
    Updated: 'bg-green-50 text-green-600',
    Archived: 'bg-gray-200 text-gray-700',
  }
  return map[s]
}

function id(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `u_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

export function UploadCenter() {
  const [rows, setRows] = useState<UploadAsset[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [tag, setTag] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [replaceTarget, setReplaceTarget] = useState<UploadAsset | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)

  async function refreshUploads() {
    const res = await fetch('/api/upload/')
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Failed to load uploads (${res.status})`)
    }
    const data = (await res.json()) as UploadAsset[]
    setRows(data)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/upload/')
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || `Failed to load uploads (${res.status})`)
        }
        const data = (await res.json()) as UploadAsset[]
        if (!cancelled) setRows(data)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load uploads'
        if (!cancelled) setSubmitError(msg)
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const effectiveRows = (rows ?? []).filter((row) => {
    const name = (row.fileName || '').trim().toLowerCase()
    return name.endsWith('.pdf') || name.endsWith('.docx')
  })

  const columns: Column<UploadAsset>[] = [
    { key: 'fn', header: 'File Name', cell: (u) => u.fileName, className: '!whitespace-normal min-w-[220px]' },
    { key: 'by', header: 'Uploaded By', cell: (u) => u.uploadedBy },
    { key: 'dt', header: 'Upload Date', cell: (u) => formatShortDate(u.uploadDate) },
    {
      key: 'st',
      header: 'Status',
      cell: (u) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(u.status)}`}>
          {u.status}
        </span>
      ),
    },
    {
      key: 'act',
      header: 'Actions',
      cell: (u) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void onDownload(u)} className="text-xs font-medium text-primary hover:underline">
            Download
          </button>
          <button type="button" onClick={() => onReplaceClick(u)} className="text-xs font-medium text-primary hover:underline">
            Replace
          </button>
          <button type="button" onClick={() => void onDelete(u)} className="text-xs font-medium text-primary hover:underline">
            Delete
          </button>
        </div>
      ),
    },
  ]

  function resetForm() {
    setTag('')
    setFile(null)
    setSubmitError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function onSubmit() {
    if (!file) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('tag', tag.trim())
      form.append('uploadedBy', 'team@affine.ai')

      const res = await fetch('/api/upload/', {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Upload failed (${res.status})`)
      }

      const now = new Date().toISOString()
      const newRow: UploadAsset = {
        id: id(), // UI id; backend stores by filename
        fileName: file.name,
        tag: tag.trim() || '—',
        uploadedBy: 'team@affine.ai',
        uploadDate: now,
        status: 'Uploaded',
      }
      setRows([newRow, ...(rows ?? [])])
      await refreshUploads()
      resetForm()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function onDownload(row: UploadAsset) {
    try {
      setSubmitError(null)
      const safeFile = encodeURIComponent(row.fileName)
      const res = await fetch(`/api/upload/documents/download/${safeFile}`)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Download failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = row.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Download failed')
    }
  }

  function onReplaceClick(row: UploadAsset) {
    const ok = window.confirm(`Replace "${row.fileName}" with a new file?`)
    if (!ok) return
    setReplaceTarget(row)
    replaceInputRef.current?.click()
  }

  async function onReplaceSelected(nextFile: File | null) {
    const target = replaceTarget
    if (!target || !nextFile) return
    try {
      setSubmitError(null)
      const form = new FormData()
      form.append('file', nextFile)
      form.append('uploadedBy', 'team@affine.ai')
      const safeFile = encodeURIComponent(target.fileName)
      const res = await fetch(`/api/upload/documents/replace/${safeFile}`, {
        method: 'PUT',
        body: form,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Replace failed (${res.status})`)
      }
      await refreshUploads()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Replace failed')
    } finally {
      setReplaceTarget(null)
      if (replaceInputRef.current) replaceInputRef.current.value = ''
    }
  }

  async function onDelete(row: UploadAsset) {
    const ok = window.confirm(`Delete "${row.fileName}"?`)
    if (!ok) return
    try {
      setSubmitError(null)
      const safeFile = encodeURIComponent(row.fileName)
      const res = await fetch(`/api/upload/documents/delete/${safeFile}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Delete failed (${res.status})`)
      }
      await refreshUploads()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#F9FAFB,_#E5E7EB)] px-4 py-6 rounded-2xl">
      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => void onReplaceSelected(e.target.files?.[0] ?? null)}
      />

      <div className="mx-auto max-w-[1800px]">
        <SectionCard
          title="Upload integration guide document"
          action={
            <div className="flex gap-2">

              <button
                type="button"
                onClick={onSubmit}
                disabled={loading || submitting || !file}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 bg-gradient-to-r from-[#7A3F1D] via-[#9C5A2F] to-[#B97A52] px-4 shadow-sm"
              >
                Upload
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={loading || submitting}
                className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          }
        >
          {loading ? (
            <div className="space-y-3">
              <LoadingSkeleton lines={2} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-black-600 ">File Upload</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 
  file:mr-3 file:rounded-md file:border-0 
  file:bg-[linear-gradient(to_right,#7A3F1D,#9C5A2F,#B97A52)] 
  file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white 
  hover:file:opacity-90"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-black-600">Tag (optional)</span>
                <input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Integration Guide / Resolution Guide / FAQ"
                  className="w-full rounded-lg border border-[#00000] px-3 py-3 text-sm"
                />
              </label>
              <div className="md:col-span-3">
                {submitError ? (
                  <p className="text-xs font-medium text-red-700">{submitError}</p>
                ) : null}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-8">
        <SectionCard title="Upload history">
          {loading ? (
            <div className="space-y-3">
              <LoadingSkeleton lines={1} />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-9 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={effectiveRows}
              getRowKey={(u) => u.id}
              empty={<p className="text-sm text-muted">No integration guide documents uploaded yet.</p>}
            />
          )}
        </SectionCard>
      </div>
    </div>
  )
}