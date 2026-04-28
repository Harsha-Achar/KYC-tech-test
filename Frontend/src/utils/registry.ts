function safeParse(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())
  } catch {
    return []
  }
}

function readList(key: string): string[] {
  if (typeof window === 'undefined') return []
  return safeParse(window.localStorage.getItem(key))
}

function writeList(key: string, values: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(values))
}

function addToList(key: string, value: string) {
  if (typeof window === 'undefined') return
  const trimmed = value.trim()
  if (!trimmed) return
  const current = readList(key)
  const next = Array.from(new Set([trimmed, ...current]))
  writeList(key, next)
}

const CLIENT_KEY = 'affine.techspec.clients.extra'
const API_PRODUCT_KEY = 'affine.techspec.apiProducts.extra'

export function getExtraClientNames(): string[] {
  return readList(CLIENT_KEY)
}

export function addExtraClientName(name: string) {
  addToList(CLIENT_KEY, name)
}

export function getExtraApiProducts(): string[] {
  return readList(API_PRODUCT_KEY)
}

export function addExtraApiProduct(name: string) {
  addToList(API_PRODUCT_KEY, name)
}

