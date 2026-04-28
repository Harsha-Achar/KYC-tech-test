import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { ChatMessage } from '../components/ChatMessage'
import { SectionCard } from '../components/SectionCard'

import type {
  ChatMessage as Msg,
  ConversationRecord,
  ClientConfigurationRecord,
  PersistentChatThread,
} from '../types'
import {
  listChatThreads,
  upsertChatThread,
  upsertConversationRecord,
} from '../utils/conversationStore'

export function AITroubleshooter({ adminEmail }: { adminEmail: string }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [diagnosis, setDiagnosis] = useState('')
  const [rootCause, setRootCause] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationRecord | null>(null)
  const [history, setHistory] = useState<PersistentChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string>('')
  const [copied, setCopied] = useState(false)


  const [clientConfigs, setClientConfigs] = useState<ClientConfigurationRecord[]>([])
  const [clientId, setClientId] = useState<string>('')
  const selectedClient = clientConfigs.find((c) => c.client_id === clientId) ?? null
  const clientName = selectedClient?.client_name ?? ''
  const apiProduct = selectedClient?.product ?? 'Unified'
  const environment = selectedClient?.environment ?? 'Sandbox'
  const activeThread = history.find((thread) => thread.id === activeThreadId) ?? null
  const conversationTitle = activeThread?.title?.trim() || 'Conversation'

  function applyThread(thread: PersistentChatThread | null) {
    if (!thread) {
      setActiveThreadId('')
      setMessages([])
      setDiagnosis('General')
      setRootCause('--')
      setChatOpen(false)
      setApiError(null)
      setConversation(null)
      return
    }
    setActiveThreadId(thread.id)
    setMessages(thread.messages ?? [])
    setDiagnosis(thread.diagnosis || 'General')
    setRootCause(thread.root_cause || '--')
    setChatOpen(true)
    setApiError(null)
    setConversation({
      id: thread.id,
      client_name: thread.client_name,
      api_product: thread.api_product,
      environment: thread.environment,
      status: thread.status ?? 'in-progress',
      created_at: thread.created_at,
      updated_at: thread.updated_at,
    })
  }

  async function refreshHistory(selectThreadId?: string) {
    try {
      const all = await listChatThreads(clientId ? { clientId } : undefined)
      setHistory(all)
      const selected = all.find((thread) => thread.id === (selectThreadId || activeThreadId)) ?? all[0] ?? null
      applyThread(selected)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load conversation history'
      setApiError(msg)
      setHistory([])
      applyThread(null)
    }
  }

  useEffect(() => {
    void refreshHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  useEffect(() => {
    let cancelled = false

    async function loadClients() {
      try {
        const res = await fetch('/api/client-config/all')
        if (!res.ok) {
          throw new Error(`Failed to load clients (${res.status})`)
        }
        const rows = (await res.json()) as ClientConfigurationRecord[]
        const sorted = [...rows].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        const latestByClient = new Map<string, ClientConfigurationRecord>()
        for (const row of sorted) {
          const key = (row.client_name || '').trim()
          if (!key || latestByClient.has(key)) continue
          latestByClient.set(key, row)
        }
        const options = Array.from(latestByClient.values()).sort((a, b) =>
          a.client_name.localeCompare(b.client_name),
        )

        if (!cancelled) {
          setClientConfigs(options)
          setClientId((prev) => (prev && options.some((opt) => opt.client_id === prev) ? prev : ''))
        }
      } catch {
        if (!cancelled) {
          setClientConfigs([])
          setClientId('')
        }
      }
    }

    void loadClients()
    return () => {
      cancelled = true
    }
  }, [])

  async function openChat() {
    if (!selectedClient) return
    const now = new Date().toISOString()
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `conv_${Math.random().toString(16).slice(2)}_${Date.now()}`

    const record: ConversationRecord = {
      id,
      client_name: clientName,
      api_product: apiProduct,
      environment,
      status: 'in-progress',
      created_at: now,
      updated_at: now,
    }

    upsertConversationRecord(record)
    await upsertChatThread({
      id,
      owner_role: 'admin',
      owner_email: adminEmail,
      client_id: selectedClient.client_id,
      client_name: clientName,
      api_product: apiProduct,
      environment,
      status: 'in-progress',
      title: 'New conversation',
      diagnosis: 'General',
      root_cause: '--',
      created_at: now,
      updated_at: now,
      messages: [],
    })
    await refreshHistory(id)
  }

  async function copyConversation() {
    const text = messages
      .map((msg) => {
        const role = msg.role === 'assistant' ? 'Assistant' : 'User'
        return `${role}: ${msg.content}`
      })
      .join('\n\n')
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setApiError('Unable to copy conversation.')
    }
  }

  return (

    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#F9FAFB,_#E5E7EB)] px-4 py-6 rounded-2xl">

      <div className="mx-auto max-w-[1800px]">
        <h1 className="text-small font-medium text-gray-900 -mt-2 mb-3">AI Chat / Troubleshooter</h1>
      </div>

      <div className="space-y-6">
        <SectionCard
          title="Client context"
          action={
            <button
              type="button"
              disabled={!selectedClient || chatOpen}
              onClick={() => void openChat()}
              className="rounded-lg bg-gradient-to-r from-[#4B1F0F] via-[#6A2E17] to-[#7A3F1D] px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 hover:opacity-90"
            >
              Open Chat
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-black-700">
              Client
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="rounded-lg border border-[#00000] bg-white p-2 text-sm font-medium"
              >
                <option value="">All clients (history)</option>
                {clientConfigs.map((cfg) => (
                  <option key={cfg.client_id} value={cfg.client_id}>
                    {cfg.client_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Client chat history">
          {history.length === 0 ? <p className="text-sm font-medium">No conversations found.</p> : null}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {history.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => void refreshHistory(thread.id)}
                className={`rounded-lg border p-3 text-left transition ${activeThreadId === thread.id
                  ? 'border-primary bg-primary/5'
                  : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
                  }`}
              >
                <p className="truncate text-sm font-medium text-gray-900">{thread.title || 'Conversation'}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {new Date(thread.updated_at).toLocaleString()} - {thread.owner_role}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  Status: {thread.status ?? 'in-progress'} | Messages: {thread.messages.length}
                </p>
              </button>
            ))}
          </div>
        </SectionCard>

        {chatOpen ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="lg:col-span-8">
              <SectionCard
                title={conversationTitle}
                action={
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await copyConversation()
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 hover:border-gray-400"
                    >
                      {copied ? '✔ Copied' : (
                        <>
                          <Copy className="size-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                }
              >
                <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-xl border border-[#E5E7EB] bg-gray-50/50 p-4">
                  {messages.map((m) => (
                    <ChatMessage key={m.id} message={m} />
                  ))}
                  {apiError ? <p className="text-sm font-medium text-red-700">{apiError}</p> : null}
                </div>
              </SectionCard>
            </section>

            <aside className="space-y-4 lg:col-span-4">
              <SectionCard title="Context summary">
                <dl className="space-y-3 text-sm">

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-sm font-medium uppercase tracking-wide text-black-600">
                      Diagnosis
                    </dt>
                    <dd className="text-right text-gray-900">
                      {diagnosis || 'General'}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-sm font-medium uppercase tracking-wide text-black-600">
                      Root Cause
                    </dt>
                    <dd className="text-gray-900 max-w-[60%] text-left ml-auto leading-relaxed">
                      {rootCause || '--'}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-sm font-medium uppercase tracking-wide text-black-600">
                      Client
                    </dt>
                    <dd className="text-right text-gray-900">
                      {conversation?.client_name || clientName || '--'}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-sm font-medium uppercase tracking-wide text-black-600">
                      API / Product
                    </dt>
                    <dd className="text-right text-gray-900">
                      {conversation?.api_product || apiProduct || '--'}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-sm font-medium uppercase tracking-wide text-black-600">
                      Environment
                    </dt>
                    <dd className="text-right text-gray-900">
                      {conversation?.environment || environment || '--'}
                    </dd>
                  </div>

                  {conversation && (
                    <div className="pt-3 border-t border-gray-200 text-[11px] text-black-900">
                      Conversation ID : {' '}
                      <span className="font-semibold text-gray-900">
                        {conversation.id}
                      </span>
                    </div>
                  )}

                </dl>
              </SectionCard>
            </aside>
          </div>
        ) : null}
      </div>

    </div>
  )
}