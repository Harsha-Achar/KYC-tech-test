

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { KpiGrid } from '../components/KpiGrid'
import { ChartCard } from '../components/ChartCard'
import { DataTable, type Column } from '../components/DataTable'
import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton'
import { SectionCard } from '../components/SectionCard'
import { getAllClients } from '../data/clients'
import { formatShortDate } from '../utils/formatters'
import { CHART_COLORS } from '../utils/chartTheme'
import { useNavigate } from 'react-router-dom'
import type {
  ClientConfigurationRecord,
  ClientConfigEnvironment,
  ClientConfigPriority,
  ClientConfigSystemType,
} from '../types'
import { PageHeader } from '../components/PageHeader'
import { MetricCard } from '../components/MetricCard'
import { X } from 'lucide-react'

type DashboardIssue = {
  id: string
  clientId: string
  title: string
  rootCause?: string
  issueType?: string
  affectedApi?: string
  severity?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  resolvedAt?: string | null
}
type OnboardingRow = ClientConfigurationRecord & { derivedStatus: string }

const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function toMillis(value?: string | null): number | null {
  if (!value) return null
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? ts : null
}

function toDayLabel(value?: string | null): string {
  const ts = toMillis(value)
  if (ts === null) return 'Unknown'
  return DAY_FORMATTER.format(new Date(ts))
}

function toDayKey(value?: string | null): string {
  const ts = toMillis(value)
  if (ts === null) return 'unknown'
  return new Date(ts).toISOString().slice(0, 10)
}

function normalizeStatus(value?: string): 'OPEN' | 'CLOSED' | 'SUCCESS' | 'FAILED_RESOLUTION' {
  const status = (value || 'OPEN').trim().toUpperCase().replace(/\s+/g, '_')
  if (status === 'SUCCESS') return 'SUCCESS'
  if (status === 'CLOSED' || status === 'RESOLVED') return 'CLOSED'
  if (status === 'FAILED_RESOLUTION' || status === 'FAILED') return 'FAILED_RESOLUTION'
  if (status === 'IN_PROGRESS' || status === 'INPROGRESS') return 'OPEN'
  return 'OPEN'
}

function normalizeSeverity(value?: string): 'Low' | 'Medium' | 'High' | 'Critical' {
  const severity = (value || '').trim().toUpperCase()
  if (severity === 'LOW') return 'Low'
  if (severity === 'HIGH') return 'High'
  if (severity === 'CRITICAL') return 'Critical'
  return 'Medium'
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

const ASSIGNED_USERS_KEY = 'affine.techspec.assignedUsers'
const SERVICE_OPTIONS = [
  'Document Management Service',
  'Embed & Processing Service',
  'Search & Retrieval Service',
  'User & Credit Ledger Service',
] as const
const INDUSTRY_OPTIONS = ['Finance', 'Medical', 'Manufacturing'] as const
type TimeFilterPreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'custom'

function readAssignedUsers(baseUsers: string[]): string[] {
  const defaults = Array.from(new Set([...baseUsers, 'team@affine.ai'])).sort((a, b) => a.localeCompare(b))
  try {
    const raw = localStorage.getItem(ASSIGNED_USERS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return defaults
    return Array.from(new Set([...defaults, ...parsed.map((v) => String(v).trim()).filter(Boolean)])).sort((a, b) =>
      a.localeCompare(b),
    )
  } catch {
    return defaults
  }
}

function writeAssignedUsers(users: string[]) {
  localStorage.setItem(ASSIGNED_USERS_KEY, JSON.stringify(users))
}

function normalizeClientDisplayName(name: string): string {
  return name === 'Affine Analytics' ? 'Annex Analytics' : name
}

export function OverviewDashboard() {
  const navigate = useNavigate()
  const onboardingSectionRef = useRef<HTMLDivElement | null>(null)
  const [issues, setIssues] = useState<DashboardIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddClientModal, setShowAddClientModal] = useState(false)
  const allClients = useMemo(() => getAllClients(), [])
  const [clientConfigRows, setClientConfigRows] = useState<ClientConfigurationRecord[]>([])
  const [clientConfigLoading, setClientConfigLoading] = useState(true)
  const [clientConfigSubmitting, setClientConfigSubmitting] = useState(false)
  const [clientConfigError, setClientConfigError] = useState<string | null>(null)
  const [clientConfigFilter, setClientConfigFilter] = useState('')
  const [assignedUsers, setAssignedUsers] = useState<string[]>([])
  const [clientName, setClientName] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [newAssignedUser, setNewAssignedUser] = useState('')
  const [services, setServices] = useState<string[]>([])
  const [environment, setEnvironment] = useState<ClientConfigEnvironment>('Sandbox')
  const [systemType, setSystemType] = useState<ClientConfigSystemType>('Cloud-native')
  const [legacyPresent, setLegacyPresent] = useState(false)
  const [llmFallback, setLlmFallback] = useState(true)
  const [industry, setIndustry] = useState<(typeof INDUSTRY_OPTIONS)[number]>('Finance')
  const [priority, setPriority] = useState<ClientConfigPriority>('Medium')
  const [lastClientId, setLastClientId] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilterPreset>('last30')
  const [showCustomDateModal, setShowCustomDateModal] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [issueCategoryPie, setIssueCategoryPie] = useState<{ name: string; value: number }[]>([])
  const [issueStatusBreakdown, setIssueStatusBreakdown] = useState<{ status: string; count: number }[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadDashboardIssues() {
      setLoading(true)
      try {
        const [listRes, categoryRes, statusRes] = await Promise.all([
          fetch('/api/issues/list'),
          fetch('/api/issues/category-breakdown'),
          fetch('/api/issues/status-breakdown'),
        ])
        if (!listRes.ok || !categoryRes.ok || !statusRes.ok) throw new Error('Failed to load dashboard data')

        const list = (await listRes.json()) as DashboardIssue[]
        const categoryData = (await categoryRes.json()) as { category: string; count: number }[]
        const statusData = (await statusRes.json()) as { status: string; count: number }[]
        if (cancelled) return
        setIssues(
          list.map((item) => ({
            ...item,
            status: normalizeStatus(item.status),
            severity: normalizeSeverity(item.severity),
          })),
        )
        setIssueCategoryPie(
          categoryData.map((x) => ({
            name: x.category === 'Integration Errors' ? 'General Technical Issues' : x.category,
            value: x.count,
          })),
        )
        const groupedStatus = { Open: 0, Closed: 0, Failed: 0 }
        statusData.forEach((x) => {
          const status = (x.status || '').trim().toUpperCase()
          if (status === 'OPEN' || status === 'IN_PROGRESS') {
            groupedStatus.Open += x.count
          } else if (status === 'RESOLVED' || status === 'CLOSED') {
            groupedStatus.Closed += x.count
          } else if (status === 'FAILED' || status === 'FAILED_RESOLUTION' || status === 'ESCALATED') {
            groupedStatus.Failed += x.count
          }
        })
        setIssueStatusBreakdown([
          { status: 'Open', count: groupedStatus.Open },
          { status: 'Closed', count: groupedStatus.Closed },
          { status: 'Failed', count: groupedStatus.Failed },
        ])
      } catch {
        if (cancelled) return
        setIssues([])
        setIssueCategoryPie([])
        setIssueStatusBreakdown([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadDashboardIssues()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadClientConfigHistory() {
    setClientConfigLoading(true)
    setClientConfigError(null)
    try {
      const res = await fetch('/api/client-config/all')
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Failed to load client configurations (${res.status})`)
      }
      const data = (await res.json()) as ClientConfigurationRecord[]
      data.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      setClientConfigRows(
        data.map((row) => ({
          ...row,
          client_name: normalizeClientDisplayName(row.client_name),
        })),
      )
    } catch (e) {
      setClientConfigRows([])
      setClientConfigError(e instanceof Error ? e.message : 'Failed to load client onboarding history')
    } finally {
      setClientConfigLoading(false)
    }
  }

  useEffect(() => {
    const users = readAssignedUsers(Array.from(new Set(allClients.map((c) => c.supportLead).filter(Boolean))))
    setAssignedUsers(users)
    if (users.length) setAssignedTo(users[0])
    void loadClientConfigHistory()
  }, [allClients])

  function toggleService(service: string) {
    setServices((prev) => (prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]))
  }

  function addAssignedUser() {
    const normalized = newAssignedUser.trim()
    if (!normalized) return
    const next = Array.from(new Set([...assignedUsers, normalized])).sort((a, b) => a.localeCompare(b))
    setAssignedUsers(next)
    writeAssignedUsers(next)
    setAssignedTo(normalized)
    setNewAssignedUser('')
  }

  const canSubmitClient = useMemo(() => {
    const effectiveAssignee = assignedTo === '__add_new__' ? newAssignedUser.trim() : assignedTo
    return Boolean(clientName.trim() && effectiveAssignee.trim() && services.length > 0)
  }, [assignedTo, clientName, newAssignedUser, services.length])

  async function onSubmitClient() {
    if (!canSubmitClient) return
    setClientConfigSubmitting(true)
    setClientConfigError(null)
    try {
      const payload = {
        client_name: clientName.trim(),
        assigned_to: assignedTo === '__add_new__' ? newAssignedUser.trim() : assignedTo,
        product: 'Unified',
        services,
        environment,
        system_type: systemType,
        legacy_present: legacyPresent,
        llm_fallback: llmFallback,
        industry,
        priority,
      }
      const res = await fetch('/api/client-config/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Failed to save client configuration (${res.status})`)
      }
      const created = (await res.json()) as ClientConfigurationRecord
      setLastClientId(created.client_id)
      if (created.assigned_to && !assignedUsers.includes(created.assigned_to)) {
        const next = Array.from(new Set([...assignedUsers, created.assigned_to])).sort((a, b) => a.localeCompare(b))
        setAssignedUsers(next)
        writeAssignedUsers(next)
      }
      setClientName('')
      setServices([])
      setEnvironment('Sandbox')
      setSystemType('Cloud-native')
      setLegacyPresent(false)
      setLlmFallback(true)
      setIndustry('Finance')
      setPriority('Medium')
      setNewAssignedUser('')
      setShowAddClientModal(false)
      await loadClientConfigHistory()
    } catch (e) {
      setClientConfigError(e instanceof Error ? e.message : 'Failed to save client onboarding record')
    } finally {
      setClientConfigSubmitting(false)
    }
  }

  const timeFilteredIssues = useMemo(() => {
    if (issues.length === 0) return issues
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    let rangeStartMs: number | null = null
    let rangeEndMs: number | null = null

    if (timeFilter === 'today') {
      rangeStartMs = startOfToday.getTime()
      rangeEndMs = rangeStartMs + 24 * 3600000
    } else if (timeFilter === 'yesterday') {
      rangeEndMs = startOfToday.getTime()
      rangeStartMs = rangeEndMs - 24 * 3600000
    } else if (timeFilter === 'last7') {
      rangeStartMs = startOfToday.getTime() - 6 * 24 * 3600000
      rangeEndMs = now.getTime()
    } else if (timeFilter === 'last30') {
      rangeStartMs = startOfToday.getTime() - 29 * 24 * 3600000
      rangeEndMs = now.getTime()
    } else if (timeFilter === 'last90') {
      rangeStartMs = startOfToday.getTime() - 89 * 24 * 3600000
      rangeEndMs = now.getTime()
    } else if (timeFilter === 'custom' && customStartDate && customEndDate) {
      rangeStartMs = new Date(`${customStartDate}T00:00:00`).getTime()
      rangeEndMs = new Date(`${customEndDate}T23:59:59`).getTime()
    }

    if (rangeStartMs === null || rangeEndMs === null) return issues
    return issues.filter((issue) => {
      const createdMs = toMillis(issue.createdAt)
      return createdMs !== null && createdMs >= rangeStartMs && createdMs <= rangeEndMs
    })
  }, [issues, timeFilter, customStartDate, customEndDate])

  const dashboardFilteredIssues = useMemo(() => {
    return timeFilteredIssues
  }, [timeFilteredIssues])

  const derivedData = useMemo(() => {
    const issuesByCreatedDay = new Map<string, { date: string; value: number }>()
    const clientStatusMap = new Map<string, 'SUCCESS' | 'CLOSED' | 'OPEN' | 'FAILED_RESOLUTION'>()

    let latestUpdatedAt = ''
    let successfulIntegrations = 0 // client-wise
    let inProgress = 0 // client-wise
    let failedIssues = 0 // client-wise
    let openIssues = 0
    let closedIssues = 0
    let failedIssueCount = 0 // issue-wise

    for (const issue of dashboardFilteredIssues) {
      const status = normalizeStatus(issue.status)
      const clientId = (issue.clientId || '').trim()
      const createdAt = issue.createdAt ?? ''
      const updatedAt = issue.updatedAt ?? createdAt

      if (status === 'SUCCESS' || status === 'CLOSED') {
        closedIssues += 1
      }
      if (status === 'OPEN') openIssues += 1
      if (status === 'FAILED_RESOLUTION') failedIssueCount += 1

      // Client-wise status precedence: FAILED > OPEN > CLOSED/SUCCESS.
      if (clientId) {
        const current = clientStatusMap.get(clientId)
        if (status === 'FAILED_RESOLUTION') {
          clientStatusMap.set(clientId, 'FAILED_RESOLUTION')
        } else if (status === 'OPEN') {
          if (current !== 'FAILED_RESOLUTION') {
            clientStatusMap.set(clientId, 'OPEN')
          }
        } else if (!current) {
          clientStatusMap.set(clientId, status)
        }
      }

      // Replacement: issueTrend now grouped day-wise from created_at.
      const createdDayKey = toDayKey(createdAt)
      const createdDayLabel = toDayLabel(createdAt)
      const createdDayAgg = issuesByCreatedDay.get(createdDayKey) ?? { date: createdDayLabel, value: 0 }
      createdDayAgg.value += 1
      issuesByCreatedDay.set(createdDayKey, createdDayAgg)

      const updatedMs = toMillis(updatedAt)
      const latestMs = toMillis(latestUpdatedAt)
      if (updatedMs !== null && (latestMs === null || updatedMs > latestMs)) {
        latestUpdatedAt = updatedAt
      }
    }

    clientStatusMap.forEach((status) => {
      if (status === 'FAILED_RESOLUTION') {
        failedIssues += 1
      } else if (status === 'OPEN') {
        inProgress += 1
      } else {
        successfulIntegrations += 1
      }
    })

    const totalIntegrations = new Set(dashboardFilteredIssues.map((issue) => issue.clientId).filter(Boolean)).size
    const successRatePct =
      totalIntegrations === 0 ? 0 : round1((successfulIntegrations / totalIntegrations) * 100)
    const nowMs = Date.now()
    const periodMs = 30 * 24 * 3600000
    const currentStart = nowMs - periodMs
    const previousStart = nowMs - periodMs * 2

    const currentWindow = dashboardFilteredIssues.filter((issue) => {
      const createdMs = toMillis(issue.createdAt)
      return createdMs !== null && createdMs >= currentStart && createdMs <= nowMs
    })
    const previousWindow = dashboardFilteredIssues.filter((issue) => {
      const createdMs = toMillis(issue.createdAt)
      return createdMs !== null && createdMs >= previousStart && createdMs < currentStart
    })

    const successfulInWindow = (rows: DashboardIssue[]) =>
      rows.filter((row) => {
        const status = normalizeStatus(row.status)
        return status === 'SUCCESS' || status === 'CLOSED'
      }).length

    const currentRate =
      currentWindow.length === 0 ? 0 : (successfulInWindow(currentWindow) / currentWindow.length) * 100
    const previousRate =
      previousWindow.length === 0 ? 0 : (successfulInWindow(previousWindow) / previousWindow.length) * 100
    const successRateDelta = round1(currentRate - previousRate)
    const successRateTrend = `${successRateDelta >= 0 ? '+' : ''}${successRateDelta}% vs prior period`

    const issueTrend = Array.from(issuesByCreatedDay.entries())
      .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
      .map(([, point]) => point)

    return {
      lastUpdatedAt: latestUpdatedAt || new Date().toISOString(),
      dashboardKpis: {
        // Replacement: KPI cards now use computed values from issues.json.
        totalIntegrations,
        successfulIntegrations,
        inProgress,
        failedOrIssues: failedIssues,
        totalIssues: dashboardFilteredIssues.length,
        openIssues,
        closedIssues,
        failedIssueCount,
        successRatePct,
        successRateTrend,
      },
      bundle: {
        issueTrend,
      },
    }
  }, [dashboardFilteredIssues])

  const clientOpenIssueMap = useMemo(() => {
    const map = new Map<string, { hasOpen: boolean; hasFailed: boolean; hasClosed: boolean }>()
    for (const issue of issues) {
      const clientKey = normalizeClientDisplayName((issue.clientId || '').trim()).toLowerCase()
      if (!clientKey) continue
      const current = map.get(clientKey) ?? { hasOpen: false, hasFailed: false, hasClosed: false }
      const status = normalizeStatus(issue.status)
      if (status === 'OPEN') current.hasOpen = true
      if (status === 'FAILED_RESOLUTION') current.hasFailed = true
      if (status === 'CLOSED' || status === 'SUCCESS') current.hasClosed = true
      map.set(clientKey, current)
    }
    return map
  }, [issues])

  const onboardingRows = useMemo<OnboardingRow[]>(() => {
    return clientConfigRows.map((row) => {
      const statusFlags = clientOpenIssueMap.get((row.client_name || '').trim().toLowerCase())
      const derivedStatus = statusFlags?.hasFailed
        ? 'Failed'
        : statusFlags?.hasOpen
          ? 'Open'
          : 'Closed'
      return { ...row, derivedStatus }
    })
  }, [clientConfigRows, clientOpenIssueMap])

  const onboardingColumns: Column<OnboardingRow>[] = [
    { key: 'name', header: 'Client Name', cell: (r) => r.client_name, className: 'min-w-[180px]' },
    { key: 'assigned', header: 'Assigned To', cell: (r) => r.assigned_to },
    { key: 'status', header: 'Status', cell: (r) => r.derivedStatus },
    {
      key: 'services',
      header: 'Services',
      cell: (r) => r.services.join(', '),
      className: '!whitespace-normal min-w-[260px]',
    },
    { key: 'priority', header: 'Priority', cell: (r) => r.priority },
    { key: 'created', header: 'Created At', cell: (r) => formatShortDate(r.created_at) },
  ]

  const filteredClientConfigRows = useMemo<OnboardingRow[]>(() => {
    if (!clientConfigFilter) return onboardingRows
    return onboardingRows.filter((row) => row.client_name === clientConfigFilter)
  }, [onboardingRows, clientConfigFilter])

  const industryCounts = useMemo(() => {
    const counters = { finance: 0, medical: 0, manufacturing: 0 }
    const latestByClient = new Map<string, ClientConfigurationRecord>()
    for (const row of clientConfigRows) {
      const key = (row.client_name || '').trim().toLowerCase()
      if (!key) continue
      const existing = latestByClient.get(key)
      if (!existing) {
        latestByClient.set(key, row)
        continue
      }
      const existingTs = Date.parse(existing.updated_at || existing.created_at || '')
      const nextTs = Date.parse(row.updated_at || row.created_at || '')
      if (Number.isFinite(nextTs) && (!Number.isFinite(existingTs) || nextTs >= existingTs)) {
        latestByClient.set(key, row)
      }
    }

    for (const row of latestByClient.values()) {
      const industry = String((row as ClientConfigurationRecord & { industry?: string }).industry || '')
        .trim()
        .toLowerCase()
      if (industry === 'finance') counters.finance += 1
      if (industry === 'medical') counters.medical += 1
      if (industry === 'manufacturing') counters.manufacturing += 1
    }
    return counters
  }, [clientConfigRows])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#F9FAFB,_#E5E7EB)] px-4 py-6 rounded-2xl">


      <PageHeader
        title="Overview Dashboard"
        meta={
          <p className="text-xs text-black">
            Last updated {formatShortDate(derivedData.lastUpdatedAt)}
          </p>
        }
        actions={
          <>
            <select
              value={timeFilter}
              onChange={(e) => {
                const next = e.target.value as TimeFilterPreset
                setTimeFilter(next)
                if (next === 'custom') setShowCustomDateModal(true)
              }}
              className="rounded-lg border border-[#00000] bg-white px-3 py-2 text-sm"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
              <option value="last90">Last 90 days</option>
              <option value="custom">Custom dates</option>
            </select>

          </>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <KpiGrid>
          <button
            type="button"
            onClick={() => onboardingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="h-full w-full rounded-xl text-left"
            title="Jump to Client Onboarding"
          >
            <div className="h-full rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:shadow-md md:p-5">
              <p className="text-xs font-medium uppercase tracking-wide">Client Portfolio</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 border-b border-black-100 pb-3">
                  <span className="text-sm text-gray-700">Total Clients</span>
                  <span className="text-xl font-semibold tabular-nums text-gray-900">
                    {derivedData.dashboardKpis.totalIntegrations}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700">Integration Success Rate</span>
                  <span className="text-xl font-semibold tabular-nums text-gray-900">
                    {derivedData.dashboardKpis.successRatePct}%
                  </span>
                </div>
              </div>
            </div>
          </button>
          <div className="h-full rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:shadow-md md:p-5">
            <p className="text-xs font-medium uppercase tracking-wide ">Status</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 border-b border-black-100 pb-3">
                <span className="text-sm text-gray-700">Successful Integrations</span>
                <span className="text-xl font-semibold tabular-nums text-gray-900">
                  {derivedData.dashboardKpis.successfulIntegrations}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-black-100 pb-3">
                <span className="text-sm text-gray-700">In Progress</span>
                <span className="text-xl font-semibold tabular-nums text-gray-900">
                  {derivedData.dashboardKpis.inProgress}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700">Failed / Facing Issues</span>
                <span className="text-xl font-semibold tabular-nums text-gray-900">
                  {derivedData.dashboardKpis.failedOrIssues}
                </span>
              </div>
            </div>
          </div>
          <div className="h-full rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:shadow-md md:p-5">
            <p className="text-xs font-medium uppercase tracking-wide ">Issues</p>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => navigate('/issues?view=table&statusPreset=all')}
                className="flex w-full items-center justify-between gap-3 border-b border-black-100 pb-3 text-left"
                title="Open Issue Monitor with all statuses"
              >
                <span className="text-sm text-gray-700">Total</span>
                <span className="text-xl font-semibold tabular-nums text-gray-900">
                  {derivedData.dashboardKpis.totalIssues}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/issues?view=table&statusPreset=open')}
                className="flex w-full items-center justify-between gap-3 border-b border-black-100 pb-3 text-left"
                title="Open Issue Monitor filtered to Open"
              >
                <span className="text-sm text-gray-700">Open</span>
                <span className="text-xl font-semibold tabular-nums text-gray-900">
                  {derivedData.dashboardKpis.openIssues}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/issues?view=table&statusPreset=closed')}
                className="flex w-full items-center justify-between gap-3 border-b border-black-100 pb-3 text-left"
                title="Open Issue Monitor filtered to Closed"
              >
                <span className="text-sm text-black-700">Closed</span>
                <span className="text-xl tabular-nums text-black-900">
                  {derivedData.dashboardKpis.closedIssues}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/issues?view=table&statusPreset=failed')}
                className="flex w-full items-center justify-between gap-3 text-left"
                title="Open Issue Monitor filtered to Failed"
              >
                <span className="text-sm text-gray-700">Failed</span>
                <span className="text-xl font-semibold tabular-nums text-gray-900">
                  {derivedData.dashboardKpis.failedIssueCount}
                </span>
              </button>
            </div>
          </div>
          <div className="h-full rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:shadow-md md:p-5">
            <p className="text-xs font-medium uppercase tracking-wide ">Industry</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 border-b border-black-100 pb-3">
                <span className="text-sm text-gray-700">Finance</span>
                <span className="text-xl font-semibold tabular-nums text-gray-900">{industryCounts.finance}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-black-100 pb-3">
                <span className="text-sm text-gray-700">Medical</span>
                <span className="text-xl font-semibold tabular-nums text-gray-900">{industryCounts.medical}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700">Manufacturing</span>
                <span className="text-xl font-semibold tabular-nums text-gray-900">
                  {industryCounts.manufacturing}
                </span>
              </div>
            </div>
          </div>
        </KpiGrid>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <ChartCard title="Issues by category" subtitle="Open pipeline snapshot">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={issueCategoryPie}
                    dataKey="value"
                    nameKey="name"
                    cx="34%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={70}
                    label={false}
                    labelLine={false}
                  >
                    {issueCategoryPie.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS.series[i % CHART_COLORS.series.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', lineHeight: '18px' }}
                    formatter={(value) => <span className="text-gray-700">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Status breakdown" subtitle="Current issue status distribution">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={issueStatusBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={CHART_COLORS.secondary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}
      </div>

      <div ref={onboardingSectionRef} className="mt-6">
        <SectionCard
          title="Client Onboarding"
          action={
            <button
              type="button"
              onClick={() => setShowAddClientModal(true)}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white shadow-small bg-gradient-to-r from-[#7A3F1D]  to-[#B97A52] px-4 shadow-sm "
            >
              Add Client
            </button>
          }
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="text-small text-black-500">Client filter</label>
            <select
              value={clientConfigFilter}
              onChange={(e) => setClientConfigFilter(e.target.value)}
              className="rounded-lg border border-[#00000] px-3 py-2 text-sm"
            >
              <option value="">All clients</option>
              {Array.from(new Set(clientConfigRows.map((row) => row.client_name))).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {clientConfigError ? <p className="mb-3 text-xs font-medium text-red-700">{clientConfigError}</p> : null}
          {clientConfigLoading ? (
            <p className="text-sm ">Loading...</p>
          ) : (
            <DataTable
              columns={onboardingColumns}
              rows={filteredClientConfigRows}
              getRowKey={(row) => row.client_id}
              empty={<p className="text-sm text-muted">No client onboarding records saved yet.</p>}
            />
          )}
        </SectionCard>
      </div>

      {showAddClientModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-4 shadow-2xl md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="mb-1 block text-small font-medium text-black-600">Add Client</h3>
              <button
                type="button"
                onClick={() => setShowAddClientModal(false)}
                className="text-black text-small font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-black-600">Client Name</span>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Enter client name"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-black-600">Client ID</span>
                <input
                  value={lastClientId}
                  readOnly
                  placeholder="Auto-generated on create"
                  className="w-full rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-black-600">Assigned To</span>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                >
                  {assignedUsers.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add new...</option>
                </select>
              </label>

              {assignedTo === '__add_new__' ? (
                <div className="md:col-span-3 flex flex-col gap-2 md:flex-row md:items-end">
                  <label className="block flex-1">
                    <span className="mb-1 block text-sm font-medium text-black-600">New Assigned User</span>
                    <input
                      value={newAssignedUser}
                      onChange={(e) => setNewAssignedUser(e.target.value)}
                      placeholder="Enter name or email"
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addAssignedUser}
                    className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium hover:bg-gray-50"
                  >
                    Add user
                  </button>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-black-600">Product</span>
                <input
                  value="Unified"
                  readOnly
                  className="w-full rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 py-2 text-sm"
                />
              </label>

              <div className="md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-black-600">Services</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SERVICE_OPTIONS.map((service) => (
                    <label
                      key={service}
                      className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={services.includes(service)}
                        onChange={() => toggleService(service)}
                      />
                      <span>{service}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-black-600">Environment</span>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as ClientConfigEnvironment)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                >
                  <option value="Sandbox">Sandbox</option>
                  <option value="Production">Production</option>
                  <option value="UAT">UAT</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-black-600">System Type</span>
                <select
                  value={systemType}
                  onChange={(e) => setSystemType(e.target.value as ClientConfigSystemType)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                >
                  <option value="Cloud-native">Cloud-native</option>
                  <option value="Legacy">Legacy</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </label>
              <div className="block">
                <span className="mb-1 block text-sm font-medium text-black-600">Legacy System Present?</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLegacyPresent(true)}
                    className={`rounded-lg border px-3 py-2 text-sm ${legacyPresent ? 'border-primary bg-primary/10 text-primary' : 'border-[#E5E7EB] bg-white'}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setLegacyPresent(false)}
                    className={`rounded-lg border px-3 py-2 text-sm ${!legacyPresent ? 'border-primary bg-primary/10 text-primary' : 'border-[#E5E7EB] bg-white'}`}
                  >
                    No
                  </button>
                </div>
              </div>
              <div className="block">
                <span className="mb-1 block text-sm font-medium text-black-600">LLM Fallback</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLlmFallback(true)}
                    className={`rounded-lg border px-3 py-2 text-sm ${llmFallback ? 'border-primary bg-primary/10 text-primary' : 'border-[#E5E7EB] bg-white'}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setLlmFallback(false)}
                    className={`rounded-lg border px-3 py-2 text-sm ${!llmFallback ? 'border-primary bg-primary/10 text-primary' : 'border-[#E5E7EB] bg-white'}`}
                  >
                    No
                  </button>
                </div>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-black-600">Industry</span>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value as (typeof INDUSTRY_OPTIONS)[number])}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                >
                  {INDUSTRY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-black-600">Priority</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ClientConfigPriority)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </label>
            </div>
            {clientConfigError ? <p className="mt-3 text-xs font-medium text-red-700">{clientConfigError}</p> : null}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onSubmitClient}
                disabled={!canSubmitClient || clientConfigSubmitting}
                className="rounded-lg bg-gradient-to-r from-[#4B1F0F] via-[#6A2E17] to-[#7A3F1D] px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {clientConfigSubmitting ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      ) : null
      }

      {
        showCustomDateModal ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-2xl md:p-5">
              <h3 className="text-base font-semibold text-gray-900">Select custom date range</h3>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600">Start date</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600">End date</span>
                  <input
                    type="date"
                    value={customEndDate}
                    min={customStartDate || undefined}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomDateModal(false)
                    if (!customStartDate || !customEndDate) setTimeFilter('last30')
                  }}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!customStartDate || !customEndDate}
                  onClick={() => {
                    setTimeFilter('custom')
                    setShowCustomDateModal(false)
                  }}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        ) : null
      }

    </div >
  )
}