import { useEffect, useState } from 'react'
import { api } from './api'

export function useApi<T>(path: string, params: Record<string, string | undefined> = {}) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const key = JSON.stringify([path, params])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    api<T>(path, params)
      .then((d) => alive && (setData(d), setLoading(false)))
      .catch((e) => alive && (setError(String(e)), setLoading(false)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { data, loading, error }
}
