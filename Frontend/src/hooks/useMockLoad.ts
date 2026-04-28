import { useEffect, useState } from 'react'

export function useMockLoad<T>(data: T, delayMs = 600): { loading: boolean; value: T | null } {
  const [loading, setLoading] = useState(true)
  const [value, setValue] = useState<T | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setValue(data)
      setLoading(false)
    }, delayMs)
    return () => window.clearTimeout(t)
  }, [data, delayMs])

  return { loading, value }
}
