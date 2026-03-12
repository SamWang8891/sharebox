/**
 * Simple authentication helper using Neon Auth (client-side)
 * 
 * In this setup, Neon Auth handles the Google OAuth flow on the client
 * and provides a session token (JWT/UUID). We store this token and 
 * send it with our API requests.
 */

export interface User {
  id: string
  email: string
  name?: string
  picture?: string
}

const TOKEN_KEY = 'sharebox_session'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * Redirect to Neon Auth login page.
 * VITE_NEON_AUTH_URL should be the full auth URL provided by Neon.
 * 
 * Example: https://ep-xxx.neonauth.us-east-2.aws.neon.build/neondb/auth/login?redirect_uri=http://localhost:5173/auth/callback
 */
export function login() {
  const authUrl = import.meta.env.VITE_NEON_AUTH_URL
  const currentUrl = window.location.origin + '/auth/callback'
  window.location.href = `${authUrl}/login?redirect_uri=${encodeURIComponent(currentUrl)}`
}

export function logout() {
  clearToken()
  window.location.href = '/'
}

export async function getUser(): Promise<User | null> {
  const token = getToken()
  if (!token) return null

  try {
    const res = await fetch('/api/admin/check', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
      clearToken()
      return null
    }
    const data = await res.json()
    if (!data.email) return null
    return { id: '', email: data.email } // ID is in DB, email is enough for us
  } catch {
    return null
  }
}
