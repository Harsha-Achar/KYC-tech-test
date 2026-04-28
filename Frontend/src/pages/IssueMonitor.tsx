import { useEffect, useMemo, useState } from 'react'
import { DataTable, type Column } from '../components/DataTable'
import { IssueStatusPill } from '../components/IssueStatusPill'
import { getClientName } from '../data/clients'
import { formatShortDate } from '../utils/formatters'
import type { Issue } from '../types'
import { useLocation, useNavigate } from 'react-router-dom'

export function IssueMonitor() {
  const navigate = useNavigate()
  const location = useLocation()
  const [rows, setRows] = useState<Issue[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadIssueMonitorData() {
      setLoadError(null)
      try {
        const [listRes] = await Promise.all([fetch('/api/issues/list')])

        if (!listRes.ok) {
          throw new Error('Failed to load issue monitor data')
        }

        const listData = (await listRes.json()) as Issue[]

        if (cancelled) return

        setRows(
          listData.map((row) => ({
            ...row,
            status: (row.status || '').trim().toUpperCase(),
          })),
        )
      } catch (e) {
        if (cancelled) return
        setRows([])
        setLoadError(e instanceof Error ? e.message : 'Failed to load issue data')
      }
    }

    void loadIssueMonitorData()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const statusPreset = (params.get('statusPreset') || '').trim().toLowerCase()
    const targetView = (params.get('view') || '').trim().toLowerCase()

    if (targetView === 'table') {
      // table is default and only view
    }

    if (statusPreset === 'all') {
      setStatusFilter('')
    } else if (statusPreset === 'open' || statusPreset === 'open-in-progress') {
      setStatusFilter('OPEN')
    } else if (statusPreset === 'closed') {
      setStatusFilter('CLOSED')
    } else if (statusPreset === 'failed') {
      setStatusFilter('FAILED')
    }
  }, [location.search])

  function handleIssueRowClick(issue: Issue) {
    const params = new URLSearchParams()
    params.set('client', issue.clientId)
    navigate(`/issue-insights?${params.toString()}`)
  }

  const columns: Column<Issue>[] = [
    {
      key: 'id',
      header: 'Issue ID',
      className: 'w-[10%]',
      cell: (i) => <span className="font-semibold text-gray-900">{i.id}</span>,
    },
    { key: 'client', header: 'Client', className: 'w-[20%] !whitespace-normal', cell: (i) => getClientName(i.clientId) },
    {
      key: 'comp',
      header: 'Affected component',
      className: 'w-[14%] !whitespace-normal',
      cell: (i) => i.affectedApi || (i as Issue & { affectedComponent?: string }).affectedComponent || '--',
    },
    { key: 'rc', header: 'Root Cause', className: 'w-[16%] !whitespace-normal', cell: (i) => i.rootCause || '--' },
    { key: 'st', header: 'Status', className: 'w-[8%]', cell: (i) => <IssueStatusPill status={i.status} /> },
    { key: 'cr', header: 'Created', className: 'w-[4%]', cell: (i) => formatShortDate(i.createdAt) },
    { key: 'up', header: 'Updated', className: 'w-[4%]', cell: (i) => formatShortDate(i.updatedAt) },
  ]

  const clientFilterOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.clientId).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const rowClient = row.clientId || ''
        const rowStatus = (row.status || '').trim().toUpperCase()
        const matchesClient = !clientFilter || rowClient === clientFilter
        const matchesStatus =
          !statusFilter ||
          (statusFilter === 'OPEN'
            ? rowStatus === 'OPEN' || rowStatus === 'IN_PROGRESS'
            : statusFilter === 'CLOSED'
              ? rowStatus === 'CLOSED' || rowStatus === 'RESOLVED'
              : statusFilter === 'FAILED'
                ? rowStatus === 'FAILED' || rowStatus === 'FAILED_RESOLUTION' || rowStatus === 'ESCALATED'
                : rowStatus === statusFilter)
        return matchesClient && matchesStatus
      }),
    [rows, clientFilter, statusFilter],
  )

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#F9FAFB,_#E5E7EB)] px-4 py-6 rounded-2xl">
      {loadError ? <p className="mb-3 text-sm font-medium text-red-700">{loadError}</p> : null}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-black-600">Client</label>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-lg border border-[#00000] bg-white px-3 py-2 text-sm"
        >
          <option value="">All clients</option>
          {clientFilterOptions.map((client) => (
            <option key={client} value={client}>
              {client}
            </option>
          ))}
        </select>

        <label className="ml-2 text-sm font-medium text-black-600">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#00000] bg-white px-3 py-2 text-sm"
        >
          <option value="">All status</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <DataTable columns={columns} rows={filteredRows} getRowKey={(i) => i.id} onRowClick={handleIssueRowClick} />
    </div>

  )
}