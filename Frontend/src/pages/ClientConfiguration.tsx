import { useEffect, useMemo, useState } from 'react'
import { SectionCard } from '../components/SectionCard'
import { DataTable, type Column } from '../components/DataTable'
import { clients } from '../data/clients'
import { formatShortDate } from '../utils/formatters'
import type {
  ClientConfigurationRecord,
  ClientConfigEnvironment,
  ClientConfigPriority,
  ClientConfigSystemType,
} from '../types'

const ASSIGNED_USERS_KEY = 'affine.techspec.assignedUsers'
const SERVICE_OPTIONS = [
  'Document Management Service',
  'Embed & Processing Service',
  'Search & Retrieval Service',
  'User & Credit Ledger Service',
] as const

function readAssignedUsers(): string[] {
  const baseUsers = Array.from(new Set(clients.map((c) => c.supportLead).filter(Boolean))).filter((u) => u !== '—')
  const defaults = Array.from(new Set([...baseUsers, 'team@affine.ai'])).sort((a, b) => a.localeCompare(b))

  try {
    const raw = localStorage.getItem(ASSIGNED_USERS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return defaults
    const merged = Array.from(
      new Set([...defaults, ...parsed.map((v) => String(v).trim()).filter(Boolean)]),
    ).sort((a, b) => a.localeCompare(b))
    return merged
  } catch {
    return defaults
  }
}

function writeAssignedUsers(users: string[]) {
  localStorage.setItem(ASSIGNED_USERS_KEY, JSON.stringify(users))
}

export function ClientConfiguration() {
  const [rows, setRows] = useState<ClientConfigurationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clientName, setClientName] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [newAssignedUser, setNewAssignedUser] = useState('')
  const [services, setServices] = useState<string[]>([])
  const [environment, setEnvironment] = useState<ClientConfigEnvironment>('Sandbox')
  const [systemType, setSystemType] = useState<ClientConfigSystemType>('Cloud-native')
  const [legacyPresent, setLegacyPresent] = useState(false)
  const [llmFallback, setLlmFallback] = useState(true)
  const [priority, setPriority] = useState<ClientConfigPriority>('Medium')
  const [lastClientId, setLastClientId] = useState('')
  const [assignedUsers, setAssignedUsers] = useState<string[]>([])

  useEffect(() => {
    const users = readAssignedUsers()
    setAssignedUsers(users)
    if (users.length) setAssignedTo(users[0])
  }, [])

  async function loadHistory() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/client-config/all')
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Failed to load client configurations (${res.status})`)
      }
      const data = (await res.json()) as ClientConfigurationRecord[]
      data.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      setRows(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load client configuration history'
      setError(msg)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

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

  const canSubmit = useMemo(() => {
    const effectiveAssignee = assignedTo === '__add_new__' ? newAssignedUser.trim() : assignedTo
    return Boolean(clientName.trim() && effectiveAssignee.trim() && services.length > 0)
  }, [assignedTo, clientName, newAssignedUser, services.length])

  async function onSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
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
        const next = Array.from(new Set([...assignedUsers, created.assigned_to])).sort((a, b) =>
          a.localeCompare(b),
        )
        setAssignedUsers(next)
        writeAssignedUsers(next)
      }

      setClientName('')
      setServices([])
      setEnvironment('Sandbox')
      setSystemType('Cloud-native')
      setLegacyPresent(false)
      setLlmFallback(true)
      setPriority('Medium')
      setNewAssignedUser('')

      await loadHistory()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save client configuration'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const columns: Column<ClientConfigurationRecord>[] = [
    { key: 'id', header: 'Client ID', cell: (r) => r.client_id, className: 'min-w-[220px]' },
    { key: 'name', header: 'Client Name', cell: (r) => r.client_name, className: 'min-w-[180px]' },
    { key: 'assigned', header: 'Assigned To', cell: (r) => r.assigned_to },
    { key: 'services', header: 'Services', cell: (r) => r.services.join(', '), className: '!whitespace-normal min-w-[260px]' },
    { key: 'env', header: 'Environment', cell: (r) => r.environment },
    { key: 'priority', header: 'Priority', cell: (r) => r.priority },
    { key: 'llm', header: 'LLM Fallback', cell: (r) => (r.llm_fallback ? 'Yes' : 'No') },
    { key: 'created', header: 'Created At', cell: (r) => formatShortDate(r.created_at) },
  ]

  return (
    <div className="mx-auto max-w-[1700px]">
      <SectionCard
        title="Create client onboarding"
        action={
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || submitting}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Submit'}
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Client Name</span>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client name"
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Client ID</span>
            <input
              value={lastClientId}
              readOnly
              placeholder="Auto-generated on create"
              className="w-full rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Assigned To</span>
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
                <span className="mb-1 block text-xs font-semibold text-gray-600">New Assigned User</span>
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
            <span className="mb-1 block text-xs font-semibold text-gray-600">Product</span>
            <input
              value="Unified"
              readOnly
              className="w-full rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 py-2 text-sm"
            />
          </label>

          <div className="md:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Services</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SERVICE_OPTIONS.map((service) => (
                <label key={service} className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm">
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
            <span className="mb-1 block text-xs font-semibold text-gray-600">Environment</span>
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
            <span className="mb-1 block text-xs font-semibold text-gray-600">System Type</span>
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
            <span className="mb-1 block text-xs font-semibold text-gray-600">Legacy System Present?</span>
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
            <span className="mb-1 block text-xs font-semibold text-gray-600">Allow LLM fallback?</span>
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
            <span className="mb-1 block text-xs font-semibold text-gray-600">Priority</span>
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

        {error ? <p className="mt-3 text-xs font-medium text-red-700">{error}</p> : null}
      </SectionCard>

      <div className="mt-8">
        <SectionCard title="Client onboarding history">
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.client_id}
              empty={<p className="text-sm text-muted">No client configurations saved yet.</p>}
            />
          )}
        </SectionCard>
      </div>
    </div>
  )
}

