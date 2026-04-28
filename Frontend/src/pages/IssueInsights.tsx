import { useEffect, useMemo, useState } from 'react'
import { SectionCard } from '../components/SectionCard'
import { useLocation } from 'react-router-dom'
import { jsPDF } from 'jspdf'

type StatusBreakdown = {
  open: number
  closed: number
  failed: number
}

type IssueRow = {
  id: string
  clientId: string
  title: string
  status?: string
  rootCause?: string
  affectedApi?: string
  createdAt?: string
  updatedAt?: string
  assignedTeam?: string
}

type ClientConfigRow = {
  client_name: string
  assigned_to?: string
  created_at?: string
  updated_at?: string
}

type HistoryMessage = {
  id?: string
  role?: 'user' | 'assistant'
  content?: string
  timestamp?: string
}

type HistoryThread = {
  id: string
  owner_email?: string
  status?: string
  updated_at?: string
  messages: HistoryMessage[]
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '--'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function prettyStatus(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function normalizeIssueStatus(value?: string): 'open' | 'closed' | 'failed' {
  const status = (value || 'OPEN').trim().toUpperCase().replace(/\s+/g, '_')
  if (status === 'FAILED' || status === 'FAILED_RESOLUTION' || status === 'ESCALATED') return 'failed'
  if (status === 'CLOSED' || status === 'RESOLVED' || status === 'SUCCESS') return 'closed'
  return 'open'
}

function normalizeClientKey(value?: string): string {
  const raw = (value || '').trim().toLowerCase()
  if (raw === 'affine analytics') return 'annex analytics'
  return raw
}

function toMillis(value?: string | null): number | null {
  if (!value) return null
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? ts : null
}

function toSentenceList(text: string, limit = 5): string[] {
  const cleaned = (text || '').replace(/\n+/g, ' ').trim()
  if (!cleaned) return []
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
    .slice(0, limit)
}

function matchScore(a: string, b: string): number {
  const aTokens = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2))
  const bTokens = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2))
  if (aTokens.size === 0 || bTokens.size === 0) return 0
  let overlap = 0
  aTokens.forEach((t) => {
    if (bTokens.has(t)) overlap += 1
  })
  return overlap / Math.max(aTokens.size, bTokens.size)
}

export function IssueInsights() {
  const location = useLocation()
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedIssueId, setSelectedIssueId] = useState('')
  const [allIssues, setAllIssues] = useState<IssueRow[]>([])
  const [clientConfigRows, setClientConfigRows] = useState<ClientConfigRow[]>([])
  const [historyThreads, setHistoryThreads] = useState<HistoryThread[]>([])
  const [loadingIssues, setLoadingIssues] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadIssues() {
    setLoadingIssues(true)
    try {
      const res = await fetch('/api/issues/list')
      if (!res.ok) return
      const data = (await res.json()) as IssueRow[]
      setAllIssues(Array.isArray(data) ? data : [])
      setError(null)
    } catch {
      setAllIssues([])
      setError('Failed to load issues data')
    } finally {
      setLoadingIssues(false)
    }
  }

  async function loadClientConfigs() {
    try {
      const res = await fetch('/api/client-config/all')
      if (!res.ok) return
      const data = (await res.json()) as ClientConfigRow[]
      setClientConfigRows(Array.isArray(data) ? data : [])
    } catch {
      setClientConfigRows([])
    }
  }

  async function loadClientHistory(clientName: string) {
    if (!clientName) {
      setHistoryThreads([])
      return
    }
    try {
      const res = await fetch(`/api/issues/client-history?client_name=${encodeURIComponent(clientName)}`)
      if (!res.ok) {
        setHistoryThreads([])
        return
      }
      const data = (await res.json()) as HistoryThread[]
      setHistoryThreads(Array.isArray(data) ? data : [])
    } catch {
      setHistoryThreads([])
    }
  }

  useEffect(() => {
    void loadIssues()
    void loadClientConfigs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clientNames = useMemo(
    () => Array.from(new Set(allIssues.map((i) => (i.clientId || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allIssues],
  )

  useEffect(() => {
    if (clientNames.length === 0) {
      if (selectedClient) setSelectedClient('')
      return
    }

    // Keep user's manual selection if it is still valid.
    if (selectedClient && clientNames.includes(selectedClient)) return

    // If arriving from Issue Monitor with ?client=..., honor it as initial/fallback selection.
    const params = new URLSearchParams(location.search)
    const clientFromQuery = (params.get('client') || '').trim()
    if (clientFromQuery && clientNames.includes(clientFromQuery)) {
      setSelectedClient(clientFromQuery)
      return
    }

    // Otherwise pick the first available client.
    setSelectedClient(clientNames[0] || '')
  }, [clientNames, location.search, selectedClient])

  useEffect(() => {
    if (!selectedClient) return
    void loadClientHistory(selectedClient)
  }, [selectedClient])

  const clientIssues = useMemo(
    () =>
      allIssues
        .filter((i) => (i.clientId || '').trim() === selectedClient)
        .sort((a, b) => (toMillis(b.updatedAt) ?? 0) - (toMillis(a.updatedAt) ?? 0)),
    [allIssues, selectedClient],
  )

  useEffect(() => {
    if (clientIssues.length === 0) {
      setSelectedIssueId('')
      return
    }
    if (selectedIssueId && clientIssues.some((issue) => issue.id === selectedIssueId)) return
    setSelectedIssueId(clientIssues[0]?.id || '')
  }, [clientIssues, selectedIssueId])

  const selectedIssue = useMemo(() => {
    if (selectedIssueId) {
      const matched = clientIssues.find((issue) => issue.id === selectedIssueId)
      if (matched) return matched
    }
    return clientIssues[0] ?? null
  }, [clientIssues, selectedIssueId])

  const clientStatusBreakdown = useMemo<StatusBreakdown>(() => {
    return clientIssues.reduce(
      (acc, issue) => {
        const normalized = normalizeIssueStatus(issue.status)
        if (normalized === 'open') acc.open += 1
        else if (normalized === 'closed') acc.closed += 1
        else acc.failed += 1
        return acc
      },
      { open: 0, closed: 0, failed: 0 },
    )
  }, [clientIssues])

  const assignedToValue = useMemo(() => {
    if (!selectedClient) return '--'
    const selectedKey = normalizeClientKey(selectedClient)
    const rows = clientConfigRows.filter((row) => normalizeClientKey(row.client_name) === selectedKey)
    if (rows.length === 0) return '--'
    rows.sort((a, b) => {
      const aTs = toMillis(a.updated_at || a.created_at || '')
      const bTs = toMillis(b.updated_at || b.created_at || '')
      return (bTs ?? 0) - (aTs ?? 0)
    })
    return (rows[0]?.assigned_to || '').trim() || '--'
  }, [clientConfigRows, selectedClient])

  const selectedIssueThread = useMemo(() => {
    if (!selectedIssue?.id) return null
    const target = `issue_${selectedIssue.id}`.toLowerCase()
    return historyThreads.find((thread) => (thread.id || '').toLowerCase() === target) ?? null
  }, [historyThreads, selectedIssue?.id])

  const selectedIssueMessages = useMemo(() => {
    const msgs = (selectedIssueThread?.messages || []).filter((m) => m?.content && m?.timestamp)
    return msgs.sort((a, b) => (toMillis(a.timestamp) ?? 0) - (toMillis(b.timestamp) ?? 0))
  }, [selectedIssueThread])

  const latestUserMessage = [...selectedIssueMessages].reverse().find((m) => m.role === 'user')
  const latestBotMessage = [...selectedIssueMessages].reverse().find((m) => m.role === 'assistant')
  const firstDiagnosisMessage = selectedIssueMessages.find((m) => m.role === 'assistant')

  const similarCases = useMemo(() => {
    if (!selectedIssue) return []
    const basis = `${selectedIssue.title || ''} ${selectedIssue.rootCause || ''}`.trim()
    if (!basis) return []
    return allIssues
      .filter((i) => i.id !== selectedIssue.id)
      .map((issue) => {
        const score = matchScore(basis, `${issue.title || ''} ${issue.rootCause || ''}`.trim())
        return { issue, score }
      })
      .filter((x) => x.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }, [allIssues, selectedIssue])

  const nextActions = useMemo(
    () => {
      const assistantTexts = selectedIssueMessages
        .filter((m) => m.role === 'assistant')
        .map((m) => (m.content || '').trim())
        .filter(Boolean)
        .reverse()
      if (assistantTexts.length === 0) return []
      const seen = new Set<string>()
      const actions: string[] = []
      for (const text of assistantTexts) {
        const suggestedFixesIdx = text.toLowerCase().indexOf('suggested fixes:')
        const actionSource = suggestedFixesIdx >= 0 ? text.slice(suggestedFixesIdx + 'suggested fixes:'.length) : text
        for (const sentence of toSentenceList(actionSource, 5)) {
          const key = sentence.toLowerCase()
          if (seen.has(key)) continue
          // Keep this card action-oriented and avoid repeating diagnosis/root-cause narrative.
          if (key.includes('diagnosis:') || key.includes('root cause:')) continue
          seen.add(key)
          actions.push(sentence)
          if (actions.length >= 6) return actions
        }
      }
      return actions
    },
    [selectedIssueMessages],
  )

  const contributingFactors = useMemo(
    () => {
      const candidates = clientIssues
        .map((issue) => (issue.rootCause || '').trim())
        .filter(Boolean)
        .filter((value, index, arr) => arr.findIndex((x) => x.toLowerCase() === value.toLowerCase()) === index)
      if (!selectedIssue?.rootCause) return candidates.slice(0, 4)
      return candidates.filter((x) => x.toLowerCase() !== selectedIssue.rootCause!.toLowerCase()).slice(0, 4)
    },
    [clientIssues, selectedIssue?.rootCause],
  )

  const timelineItems = [
    { label: 'Issue created', value: selectedIssue?.createdAt ? formatDateTime(selectedIssue.createdAt) : '' },
    { label: 'First diagnosis generated', value: firstDiagnosisMessage?.timestamp ? formatDateTime(firstDiagnosisMessage.timestamp) : '' },
    { label: 'Last client message', value: latestUserMessage?.timestamp ? formatDateTime(latestUserMessage.timestamp) : '' },
    { label: 'Latest bot recommendation', value: latestBotMessage?.timestamp ? formatDateTime(latestBotMessage.timestamp) : '' },
  ].filter((i) => i.value)

  function downloadReport() {
    if (!selectedClient) return
    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const marginX = 40
    const maxWidth = pageWidth - marginX * 2
    const lineHeight = 16
    let y = 48

    const ensureSpace = (requiredHeight: number) => {
      if (y + requiredHeight > pageHeight - 40) {
        doc.addPage()
        y = 48
      }
    }

    const writeLine = (text: string, fontSize = 11, bold = false) => {
      const safeText = text || '--'
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(fontSize)
      const lines = doc.splitTextToSize(safeText, maxWidth) as string[]
      ensureSpace(lines.length * lineHeight + 4)
      lines.forEach((line) => {
        doc.text(line, marginX, y)
        y += lineHeight
      })
    }

    const writeSectionTitle = (title: string) => {
      y += 8
      writeLine(title, 13, true)
      y += 2
    }

    writeLine('Issue Insights Report', 16, true)
    y += 8

    writeSectionTitle('Summary')
    writeLine(`Client: ${selectedClient}`)
    writeLine(`Issue ID: ${selectedIssue?.id || '--'}`)
    writeLine(`Current Status: ${prettyStatus(selectedIssue?.status || 'NO_ISSUES')}`)
    writeLine(`Affected Component: ${selectedIssue?.affectedApi || '--'}`)
    writeLine(`Created Date: ${selectedIssue?.createdAt ? formatDateTime(selectedIssue.createdAt) : '--'}`)
    writeLine(`Last Updated: ${selectedIssue?.updatedAt ? formatDateTime(selectedIssue.updatedAt) : '--'}`)
    writeLine(`Assigned To: ${assignedToValue}`)
    writeLine(
      `Issue Count: ${clientIssues.length} (Open ${clientStatusBreakdown.open}, Closed ${clientStatusBreakdown.closed}, Failed ${clientStatusBreakdown.failed})`,
    )

    writeSectionTitle('Root Cause Intelligence')
    writeLine(`Primary Root Cause: ${selectedIssue?.rootCause || '--'}`)
    if (contributingFactors.length > 0) {
      writeLine('Contributing Factors:', 11, true)
      contributingFactors.forEach((factor, idx) => writeLine(`${idx + 1}. ${factor}`))
    }

    writeSectionTitle('Recommended Next Actions')
    if (nextActions.length > 0) {
      nextActions.forEach((action, idx) => writeLine(`${idx + 1}. ${action}`))
    } else {
      writeLine('No action suggestions available for this issue yet.')
    }

    writeSectionTitle('Timeline / Activity Trail')
    if (timelineItems.length > 0) {
      timelineItems.forEach((item) => writeLine(`${item.label}: ${item.value}`))
    } else {
      writeLine('No timeline data available.')
    }

    const issuePart = (selectedIssue?.id || 'issue').replace(/[^a-zA-Z0-9_-]/g, '_')
    const clientPart = selectedClient.replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `issue_insights_${clientPart}_${issuePart}.pdf`
    doc.save(fileName)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#F9FAFB,_#E5E7EB)] px-4 py-6 rounded-2xl">
      <SectionCard
        title="Issue Insights"
        action={
          <button
            type="button"
            disabled={!selectedClient}
            onClick={downloadReport}
            className="rounded-lg bg-gradient-to-r from-[#4B1F0F] via-[#6A2E17] to-[#7A3F1D] px-3 py-2 text-small font-medium text-white shadow-sm disabled:opacity-50 "
          >
            Download Report
          </button>
        }
      >
        <div className="space-y-1 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-black-600">Client</span>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full rounded-lg border border-[#00000] bg-white px-3 py-2 text-sm"
              disabled={loadingIssues || clientNames.length === 0}
            >
              {clientNames.length === 0 ? <option value="">No clients found</option> : null}
              {clientNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-black-600">Issue</span>
            <select
              value={selectedIssueId}
              onChange={(e) => setSelectedIssueId(e.target.value)}
              className="w-full rounded-lg border border-[#00000] bg-white px-3 py-2 text-sm"
              disabled={!selectedClient || clientIssues.length === 0}
            >
              {clientIssues.length === 0 ? <option value="">No issues for selected client</option> : null}
              {clientIssues.map((issue) => (
                <option key={issue.id} value={issue.id}>
                  {issue.id} - {issue.title || issue.rootCause || 'Issue'}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-[#E5E7EB] bg-white shadow-sm p-4 md:grid-cols-4">
          {selectedIssue?.id ? (
            <p className="text-sm font-medium">
              <span className="font-bold">Issue ID :</span> {selectedIssue.id}
            </p>
          ) : null}
          <p className="text-sm font-medium">
            <span className="font-bold">Client :</span> {selectedClient || '--'}
          </p>
          <p className="text-sm font-medium">
            <span className="font-bold">Current Status :</span>{' '}
            {prettyStatus(selectedIssue?.status || 'NO_ISSUES')}
          </p>
          {selectedIssue?.affectedApi ? (
            <p className="text-sm font-medium">
              <span className="font-bold">Affected Component :</span> {selectedIssue.affectedApi}
            </p>
          ) : null}
          {selectedIssue?.createdAt ? (
            <p className="text-sm font-medium">
              <span className="font-bold">Created Date :</span> {formatDateTime(selectedIssue.createdAt)}
            </p>
          ) : null}
          <p className="text-sm font-medium">
            <span className="font-bold">Last Updated :</span>{' '}
            {formatDateTime(
              selectedIssue?.updatedAt ??
              clientIssues.reduce<string | null>((latest, issue) => {
                const latestMs = toMillis(latest)
                const issueMs = toMillis(issue.updatedAt)
                if (issueMs === null) return latest
                if (latestMs === null || issueMs > latestMs) return issue.updatedAt || latest
                return latest
              }, null),
            )}
          </p>
          <p className="text-sm font-medium">
            <span className="font-bold">Assigned To :</span> {assignedToValue}
          </p>
          <p className="text-sm font-medium">
            <span className="font-bold">Issue Count :</span> {clientIssues.length} (O {clientStatusBreakdown.open} / C{' '}
            {clientStatusBreakdown.closed} / F {clientStatusBreakdown.failed})
          </p>
        </div>
        {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
      </SectionCard>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">        <SectionCard title="Root Cause Intelligence" className="h-full">
        <div className="space-y-3 text-sm font-medium">
          {selectedIssue?.rootCause ? (
            <p>
              <span className="font-bold">Primary Root Cause :</span> {selectedIssue.rootCause}
            </p>
          ) : null}
          {contributingFactors.length > 0 ? (
            <div>
              <p className="text-sm font-medium">Contributing Factors</p>
              <ul className="mt-1 list-disc pl-5">
                {contributingFactors.map((item, idx) => (
                  <li key={`${idx}_${item.slice(0, 20)}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="text-sm font-medium">Evidence Used</p>
            <ul className="mt-1 list-disc pl-5">
              {selectedIssue?.title ? <li>Selected issue summary: {selectedIssue.title}</li> : null}
            </ul>
          </div>
        </div>
      </SectionCard>

        {nextActions.length > 0 ? (
          <SectionCard title="Recommended Next Actions" className="h-full">
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800">
              {nextActions.map((action, idx) => (
                <li key={`${idx}_${action.slice(0, 20)}`}>{action}</li>
              ))}
            </ul>
          </SectionCard>
        ) : (
          <SectionCard title="Recommended Next Actions" className="h-full">
            <p className="text-sm font-medium">No action suggestions available for this issue yet.</p>
          </SectionCard>
        )}

        {similarCases.length > 0 ? (
          <SectionCard title="Similar Cases" className="h-full">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-left text-sm font-medium uppercase tracking-wide text-gray-700">
                    <th className="px-2 py-2">Issue ID</th>
                    <th className="px-2 py-2">Client</th>
                    <th className="px-2 py-2">Root Cause</th>
                    <th className="px-2 py-2">Resolution Status</th>
                    <th className="px-2 py-2">Match %</th>
                  </tr>
                </thead>
                <tbody>
                  {similarCases.map(({ issue, score }) => (
                    <tr key={issue.id} className="">
                      <td className="px-2 py-2 font-medium text-gray-900">{issue.id}</td>
                      <td className="px-2 py-2 text-gray-700">{issue.clientId}</td>
                      <td className="px-2 py-2 text-gray-700">{issue.rootCause || '--'}</td>
                      <td className="px-2 py-2 text-gray-700">{prettyStatus(issue.status || 'OPEN')}</td>
                      <td className="px-2 py-2 text-gray-700">{Math.round(score * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Similar Cases" className="h-full">
            <p className="text-sm font-medium">No similar cases found.</p>
          </SectionCard>
        )}

        {timelineItems.length > 0 ? (
          <SectionCard title="Timeline / Activity Trail" className="h-full">
            <div className="space-y-2 text-sm font-medium">
              {timelineItems.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-right text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Timeline / Activity Trail" className="h-full">
            <p className="text-sm font-medium">No timeline data available.</p>
          </SectionCard>
        )}
      </div>

    </div>
  )
}