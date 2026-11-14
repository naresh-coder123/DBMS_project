import { useEffect, useState } from 'react'
import { api, explain } from '../lib/api'

export function useApi<T>(path: string, token = '') {
  const [result, setResult] = useState<{ data?: T; error?: string }>({})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api<T>(path, token, undefined, controller.signal).then(
      data => { if (!controller.signal.aborted) setResult({ data }) },
      error => { if (!controller.signal.aborted) setResult({ error: explain(error) }) },
    )
    return () => controller.abort()
  }, [path, token, attempt])
  return { ...result, retry: () => { setResult({}); setAttempt(value => value + 1) } }
}
