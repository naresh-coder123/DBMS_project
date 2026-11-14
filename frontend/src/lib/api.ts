class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, token = '', body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api' + path, {
    signal,
    method: body ? 'POST' : 'GET',
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(data?.error || 'The server is unavailable. Please try again.', response.status)
  if (data === null) throw new Error('The server returned an empty response.')
  return data as T
}

export function explain(error: unknown) {
  return error instanceof ApiError && error.status === 401
    ? 'Your credentials or session could not be verified. Please log in again.'
    : error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
