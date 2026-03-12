import { getToken } from './auth'

export async function apiFetch<T>(
  path: string, 
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `HTTP error ${res.status}`)
  }

  return res.json() as Promise<T>
}

export interface FileMetadata {
  id: number
  short_id: string
  filename: string
  mime_type: string | null
  size: number
  uploader_email: string
  is_protected: boolean
  expires_at: string | null
  downloads: number
  created_at: string
}

export interface UserStats {
  isAdmin: boolean
  email: string
}
