
import { useEffect, useMemo, useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { ChatMessage } from '../components/ChatMessage'
import { ChatComposer } from '../components/ChatComposer'
import { SectionCard } from '../components/SectionCard'
import { LayoutDashboard, AlertTriangle, Bot, Upload, FileText, Scale } from 'lucide-react'
import type { ChatMessage as Msg, PersistentChatThread } from '../types'
import {
  appendMessageToThread,
  listChatThreads,
  updateChatThreadMeta,
  upsertChatThread,
} from '../utils/conversationStore'
import { NavLink, useNavigate } from 'react-router-dom'

function makeId(prefix: string) {
  const now = new Date().toISOString()
  return `${prefix}_${now}_${Math.random().toString(16).slice(2)}`
}

function resolveConversationTitle(value: string | null | undefined) {
  const title = (value || '').trim()
  return title || 'New conversation'
}

export function ClientChatbotPage({ userEmail }: { userEmail: string }) {
  const [typing, setTyping] = useState(false)
  const [threads, setThreads] = useState<PersistentChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [diagnosis, setDiagnosis] = useState('General')
  const [rootCause, setRootCause] = useState('--')
  const [apiError, setApiError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string>('')
  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [ticketToEmail, setTicketToEmail] = useState('')
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketBody, setTicketBody] = useState('')
  const [ticketSending, setTicketSending] = useState(false)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null)
  const [nameModalOpen, setNameModalOpen] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [nameMode, setNameMode] = useState<'new' | 'rename'>('new')
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()


  const clientId = useMemo(() => `client:${userEmail}`, [userEmail])
  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null
  const activeConversationTitle = activeThread?.title?.trim() || 'Conversation'

  async function refreshThreads(selectId?: string) {
    try {
      const all = await listChatThreads({
        ownerRole: 'client',
        ownerEmail: userEmail,
        clientId,
      })
      setThreads(all)
      const preferred = selectId || activeThreadId || all[0]?.id || ''
      const selected = all.find((thread) => thread.id === preferred) ?? null
      if (!selected) {
        setActiveThreadId('')
        setConversationId('')
        setMessages([])
        setDiagnosis('General')
        setRootCause('--')
        return
      }
      setActiveThreadId(selected.id)
      setConversationId(selected.id)
      setMessages(selected.messages ?? [])
      setDiagnosis(selected.diagnosis || 'General')
      setRootCause(selected.root_cause || '--')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load history'
      setApiError(msg)
    }
  }

  useEffect(() => {
    void refreshThreads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail])

  async function startNewChat(personName?: string): Promise<string> {
    const now = new Date().toISOString()
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : makeId('conv')
    const thread: PersistentChatThread = {
      id,
      owner_role: 'client',
      owner_email: userEmail,
      client_id: clientId,
      client_name: 'Client User',
      api_product: 'Unified',
      environment: 'Sandbox',
      status: 'in-progress',
      title: resolveConversationTitle(personName),
      diagnosis: 'General',
      root_cause: '--',
      created_at: now,
      updated_at: now,
      messages: [],
    }
    await upsertChatThread(thread)
    await refreshThreads(id)
    setApiError(null)
    return id
  }

  async function renameConversation(threadId: string, currentTitle: string) {
    try {
      const title = resolveConversationTitle(currentTitle)
      await updateChatThreadMeta(threadId, {
        title,
        updated_at: new Date().toISOString(),
      })
      await refreshThreads(threadId)
      setApiError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to rename conversation'
      setApiError(msg)
    }
  }

  function openNewChatNameModal() {
    setNameMode('new')
    setNameValue('')
    setRenameThreadId(null)
    setNameModalOpen(true)
  }

  function openRenameNameModal(threadId: string, currentTitle: string) {
    setNameMode('rename')
    setRenameThreadId(threadId)
    setNameValue(currentTitle === 'New conversation' ? '' : currentTitle)
    setNameModalOpen(true)
  }

  async function submitNameModal() {
    if (nameMode === 'new') {
      await startNewChat(nameValue)
    } else if (renameThreadId) {
      await renameConversation(renameThreadId, nameValue)
    }
    setNameModalOpen(false)
    setNameValue('')
    setRenameThreadId(null)
  }

  async function sendMessage(payload: { text: string; attachments: File[] }) {
    const text = payload.text.trim()
    const attachmentNames = payload.attachments.map((f) => f.name)
    if (!text && attachmentNames.length === 0) return
    const threadId = activeThreadId || (await startNewChat())

    const now = new Date().toISOString()
    const userMsg: Msg = {
      id: makeId('u'),
      role: 'user',
      content: text,
      timestamp: now,
      attachments: attachmentNames.length ? attachmentNames : undefined,
    }
    setMessages((prev) => [...prev, userMsg])
    await appendMessageToThread(threadId, userMsg)
    await refreshThreads(threadId)
    setTyping(true)
    setApiError(null)

    try {
      const query =
        attachmentNames.length > 0
          ? `${text}\n\nAttachments: ${attachmentNames.join(', ')}`
          : text

      const formData = new FormData()
      formData.set('query', query)
      formData.set('user_id', 'default_user')
      formData.set('client_name', 'Client User')
      formData.set('persona', 'technical')
      const firstImageAttachment = payload.attachments.find((f) => f.type?.startsWith('image/'))
      if (firstImageAttachment) {
        formData.set('image', firstImageAttachment)
      }

      const res = await fetch('/api/chatbot/chat', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `Chat failed (${res.status})`)
      }

      const data = (await res.json()) as {
        type?: string
        question?: string
        answer?: string
        diagnosis?: string
        rootCause?: string
      }

      if (data.type === 'CLARIFICATION') {
        setDiagnosis('General')
        setRootCause('--')
        const clarificationMsg: Msg = {
          id: makeId('a'),
          role: 'assistant',
          content: (data.question ?? '').trim() || 'Could you share more detail?',
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, clarificationMsg])
        await appendMessageToThread(threadId, clarificationMsg)
        await updateChatThreadMeta(threadId, {
          diagnosis: 'General',
          root_cause: '--',
          updated_at: clarificationMsg.timestamp,
        })
        await refreshThreads(threadId)
        return
      }

      setDiagnosis(data.diagnosis ?? 'General')
      setRootCause(data.rootCause ?? '--')
      const assistantMsg: Msg = {
        id: makeId('a'),
        role: 'assistant',
        content: data.answer ?? '',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      await appendMessageToThread(threadId, assistantMsg)
      await updateChatThreadMeta(threadId, {
        diagnosis: data.diagnosis ?? 'General',
        root_cause: data.rootCause ?? '--',
        updated_at: assistantMsg.timestamp,
      })
      await refreshThreads(threadId)
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Chat failed')
    } finally {
      setTyping(false)
    }
  }

  const adminNav = [

    { to: '/ai troubleshooting ', label: 'AI Troubleshooting ', icon: FileText },
    { to: '/compatibility', label: 'Compatibility', icon: Scale },

  ]
  // function openRaiseTicketModal() {
  //   setTicketSubject('')
  //   setTicketBody('')
  //   setTicketToEmail('')
  //   setTicketError(null)
  //   setTicketSuccess(null)
  //   setTicketModalOpen(true)
  // }

  async function sendTicketEmail() {
    const to = ticketToEmail.trim()
    const subject = ticketSubject.trim()
    const body = ticketBody.trim()
    if (!to || !subject || !body) {
      setTicketError('Please fill To, Subject, and Body before sending.')
      return
    }

    setTicketSending(true)
    setTicketError(null)
    setTicketSuccess(null)
    try {
      const res = await fetch('/api/chatbot/send-ticket-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromEmail: userEmail,
          toEmail: to,
          subject,
          body,
          conversationId: conversationId || null,
          diagnosis,
          rootCause,
        }),
      })

      if (!res.ok) {
        let message = `Failed to send email (${res.status})`
        try {
          const json = (await res.json()) as { detail?: string }
          if (json?.detail) {
            message = json.detail
          }
        } catch {
          const text = await res.text().catch(() => '')
          if (text) message = text
        }
        throw new Error(message)
      }

      setTicketSuccess('Ticket email sent successfully.')
      setTicketModalOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send email'
      setTicketError(msg)
    } finally {
      setTicketSending(false)
    }
  }

  return (
    <div className="flex h-full w-full max-w-none min-h-0 flex-col rounded-2xl 
bg-[radial-gradient(circle_at_top,_#F9FAFB,_#E5E7EB)] px-4 pt-5 pb-6">

      {/* <div className="mb-2">
        <h1 className="text-lg font-semibold text-gray-900">Client history | Chatbot</h1>
      </div> */}



      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
        <aside className="col-span-2">
          <div className="space-y-1">
            {adminNav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive
                    ? 'border border-black bg-black/10'
                    : 'text-gray-700 hover:bg-black/10 hover:text-black-300'
                  }`
                }
              >
                <Icon className="" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
          {/* <SectionCard
            title="Client History"
            action={
              <button
                type="button"
                onClick={openNewChatNameModal}
                className="rounded-lg bg-gradient-to-r from-[#4B1F0F] via-[#6A2E17] to-[#7A3F1D] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 cursor-pointer"
              >
                New chat
              </button>
            }
          >
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">            {threads.length === 0 && (
              <p className="text-xs text-muted">No previous chats found.</p>
            )}

              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => void refreshThreads(thread.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${activeThreadId === thread.id
                    ? 'border-primary bg-primary/5'
                    : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-gray-900">
                      {thread.title || 'Conversation'}
                    </p>

                    <button
                      type="button"
                      className="rounded border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openRenameNameModal(thread.id, thread.title || '');
                      }}
                    >
                      Rename
                    </button>
                  </div>

                  <p className="mt-1 text-[11px] text-muted">
                    {new Date(thread.updated_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </SectionCard> */}
        </aside>

        <section className="flex min-h-0 col-span-8">
          <SectionCard
            className="flex h-full min-h-0 w-full flex-col"
            title={activeConversationTitle}
            action={
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-medium hover:bg-gray-50"
                  onClick={() => setTyping(true)}
                >
                  <RefreshCw className="size-3.5" />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-medium hover:bg-gray-50"
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
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-[#E5E7EB] bg-gray-50/50 p-4">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
              {typing ? <p className="text-xs">Assistant is analyzing…</p> : null}
              {apiError ? <p className="text-xs font-medium text-red-700">{apiError}</p> : null}
            </div>
            <div className="mt-3">
              <ChatComposer onSend={sendMessage} disabled={typing} />
            </div>
          </SectionCard>
        </section>

        <aside className="col-span-2 flex flex-col gap-3 self-start">
          <SectionCard
            title="Client History"
            action={
              <button
                type="button"
                onClick={openNewChatNameModal}
                className="rounded-lg bg-gradient-to-r from-[#4B1F0F] via-[#6A2E17] to-[#7A3F1D] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 cursor-pointer"
              >
                New chat
              </button>
            }
          >
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">            {threads.length === 0 && (
              <p className="text-xs text-muted">No previous chats found.</p>
            )}

              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => void refreshThreads(thread.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${activeThreadId === thread.id
                    ? 'border-primary bg-primary/5'
                    : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-gray-900">
                      {thread.title || 'Conversation'}
                    </p>

                    <button
                      type="button"
                      className="rounded border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openRenameNameModal(thread.id, thread.title || '');
                      }}
                    >
                      Rename
                    </button>
                  </div>

                  <p className="mt-1 text-[11px] text-muted">
                    {new Date(thread.updated_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </SectionCard>
        </aside>
      </div>

      {ticketModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-b-2xl border border-[#E5E7EB] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-small font-medium text-black-900">Raise Ticket via Email</h3>
              <div className="mb-4 flex items-center justify-between">

                <button
                  type="button"
                  onClick={() => setTicketModalOpen(false)}
                  className="text-black text-small font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                From
                <input
                  type="email"
                  value={userEmail}
                  readOnly
                  className="rounded-lg border border-[#E5E7EB] bg-gray-100 p-2 text-sm text-gray-700"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                To
                <input
                  type="email"
                  value={ticketToEmail}
                  onChange={(e) => setTicketToEmail(e.target.value)}
                  placeholder="Enter recipient email"
                  className="rounded-lg border border-[#E5E7EB] bg-white p-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                Subject
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Enter email subject"
                  className="rounded-lg border border-[#E5E7EB] bg-white p-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                Body
                <textarea
                  value={ticketBody}
                  onChange={(e) => setTicketBody(e.target.value)}
                  rows={10}
                  placeholder="Describe your issue details"
                  className="resize-none rounded-lg border border-[#E5E7EB] bg-white p-2 text-sm"
                  style={{ resize: 'none' }}
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
                onClick={() => setTicketModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={ticketSending}
                className="rounded-lg bg-gradient-to-r from-[#4B1F0F] via-[#6A2E17] to-[#7A3F1D] px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 hover:opacity-90"
                onClick={() => void sendTicketEmail()}
              >
                {ticketSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {nameModalOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold text-gray-900">
              {nameMode === 'new' ? 'New Conversation' : 'Rename Conversation'}
            </p>
            <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-gray-700">
              Person name
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                placeholder="Enter person name"
                className="rounded-lg border border-[#E5E7EB] bg-white p-2 text-sm"
                autoFocus
              />
            </label>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
                onClick={() => setNameModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-gradient-to-r from-[#4B1F0F] via-[#6A2E17] to-[#7A3F1D] px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 hover:opacity-90"
                onClick={() => void submitNameModal()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

