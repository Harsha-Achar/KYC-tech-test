import type {
  ChatMessage,
  ConversationRecord,
  ConversationStatus,
  PersistentChatThread,
} from '../types'

const KEY = 'affine.techspec.conversations'
const THREADS_KEY = 'affine.techspec.chat.threads'

function safeParse(value: string | null): ConversationRecord[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as ConversationRecord[]
  } catch {
    return []
  }
}

export function getConversationRecords(): ConversationRecord[] {
  if (typeof window === 'undefined') return []
  return safeParse(window.localStorage.getItem(KEY))
}

export function upsertConversationRecord(record: ConversationRecord) {
  if (typeof window === 'undefined') return
  const all = getConversationRecords()
  const idx = all.findIndex((r) => r.id === record.id)
  const next = [...all]
  if (idx >= 0) next[idx] = record
  else next.unshift(record)
  window.localStorage.setItem(KEY, JSON.stringify(next))
}

export function updateConversationStatus(id: string, status: ConversationStatus) {
  const all = getConversationRecords()
  const idx = all.findIndex((r) => r.id === id)
  if (idx < 0) return
  const now = new Date().toISOString()
  const next = [...all]
  next[idx] = { ...next[idx]!, status, updated_at: now }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  }
}

function safeParseThreads(value: string | null): PersistentChatThread[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as PersistentChatThread[]
  } catch {
    return []
  }
}

function readThreads(): PersistentChatThread[] {
  if (typeof window === 'undefined') return []
  return safeParseThreads(window.localStorage.getItem(THREADS_KEY))
}

function writeThreads(next: PersistentChatThread[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(THREADS_KEY, JSON.stringify(next))
}

function filterThreads(
  all: PersistentChatThread[],
  filters?: {
    ownerRole?: 'admin' | 'client'
    ownerEmail?: string
    clientId?: string
  },
): PersistentChatThread[] {
  return all.filter((thread) => {
    if (filters?.ownerRole && thread.owner_role !== filters.ownerRole) return false
    if (filters?.ownerEmail && thread.owner_email !== filters.ownerEmail) return false
    if (filters?.clientId && thread.client_id !== filters.clientId) return false
    return true
  })
}

function sortThreads(rows: PersistentChatThread[]): PersistentChatThread[] {
  return [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export async function listChatThreads(filters?: {
  ownerRole?: 'admin' | 'client'
  ownerEmail?: string
  clientId?: string
}): Promise<PersistentChatThread[]> {
  try {
    const params = new URLSearchParams()
    if (filters?.ownerRole) params.set('ownerRole', filters.ownerRole)
    if (filters?.ownerEmail) params.set('ownerEmail', filters.ownerEmail)
    if (filters?.clientId) params.set('clientId', filters.clientId)
    const query = params.toString()
    const res = await fetch(`/api/chatbot/conversations${query ? `?${query}` : ''}`)
    if (!res.ok) {
      throw new Error(`Failed to load conversations (${res.status})`)
    }
    const rows = (await res.json()) as PersistentChatThread[]
    const sorted = sortThreads(Array.isArray(rows) ? rows : [])
    writeThreads(sorted)
    return sorted
  } catch {
    const all = readThreads()
    return sortThreads(filterThreads(all, filters))
  }
}

export function getChatThreadById(threadId: string): PersistentChatThread | null {
  const all = readThreads()
  return all.find((thread) => thread.id === threadId) ?? null
}

export async function upsertChatThread(thread: PersistentChatThread): Promise<void> {
  const all = readThreads()
  const idx = all.findIndex((t) => t.id === thread.id)
  const next = [...all]
  if (idx >= 0) {
    next[idx] = thread
  } else {
    next.unshift(thread)
  }
  writeThreads(next)
  try {
    await fetch('/api/chatbot/conversations/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(thread),
    })
  } catch {
    // Keep local state as fallback if backend is unavailable.
  }
}

export async function appendMessageToThread(threadId: string, message: ChatMessage): Promise<void> {
  const all = readThreads()
  const idx = all.findIndex((thread) => thread.id === threadId)
  if (idx < 0) return
  const existing = all[idx]!
  const nextThread: PersistentChatThread = {
    ...existing,
    messages: [...existing.messages, message],
    updated_at: message.timestamp,
  }
  const next = [...all]
  next[idx] = nextThread
  writeThreads(next)
  try {
    await fetch(`/api/chatbot/conversations/${encodeURIComponent(threadId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
  } catch {
    // Keep local state as fallback if backend is unavailable.
  }
}

export async function updateChatThreadMeta(
  threadId: string,
  payload: Partial<
    Pick<PersistentChatThread, 'diagnosis' | 'root_cause' | 'status' | 'title' | 'updated_at'>
  >,
): Promise<void> {
  const all = readThreads()
  const idx = all.findIndex((thread) => thread.id === threadId)
  if (idx < 0) return
  const nextThread: PersistentChatThread = { ...all[idx]!, ...payload }
  const next = [...all]
  next[idx] = nextThread
  writeThreads(next)
  try {
    await fetch(`/api/chatbot/conversations/${encodeURIComponent(threadId)}/meta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Keep local state as fallback if backend is unavailable.
  }
}

// Backward compatibility for earlier page usage.
export function saveConversation(clientId: string, messages: ChatMessage[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`chat_${clientId}`, JSON.stringify(messages))
}

export function getConversation(clientId: string): ChatMessage[] {
  if (typeof window === 'undefined') return []
  const data = window.localStorage.getItem(`chat_${clientId}`)
  if (!data) return []
  try {
    const parsed = JSON.parse(data) as unknown
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : []
  } catch {
    return []
  }
}