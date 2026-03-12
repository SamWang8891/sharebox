import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setToken, login as redirectLogin } from '../auth'

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      setToken(token)
      navigate('/dashboard')
    }
  }, [navigate])

  const handleLogin = () => {
    setLoading(true)
    redirectLogin()
  }

  return (
    <div className="flex items-center justify-center pt-24 sm:pt-40">
      <div className="card max-w-sm w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <div className="bg-blue-600 text-white p-3 rounded-2xl w-fit mx-auto mb-6 shadow-lg shadow-blue-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome to ShareBox</h1>
          <p className="text-slate-500">Sign in to start sharing files securely</p>
        </div>

        <div className="space-y-4 pt-4">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm hover:shadow active:scale-[0.98] disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M44.5 20H24V29H35.8C34.7 33.9 30.1 37 24 37C16.8 37 11 31.2 11 24C11 16.8 16.8 11 24 11C27.1 11 29.9 12.1 32.1 14L38.7 7.4C34.7 3.7 29.6 1.5 24 1.5C11.6 1.5 1.5 11.6 1.5 24C1.5 36.4 11.6 46.5 24 46.5C35.5 46.5 45.5 37.5 45.5 24C45.5 22.6 45.4 21.3 45.1 20H44.5Z" fill="#EA4335" />
              <path d="M44.5 20H24V29H35.8C34.7 33.9 30.1 37 24 37C16.8 37 11 31.2 11 24C11 16.8 16.8 11 24 11C27.1 11 29.9 12.1 32.1 14L38.7 7.4C34.7 3.7 29.6 1.5 24 1.5C11.6 1.5 1.5 11.6 1.5 24C1.5 36.4 11.6 46.5 24 46.5C35.5 46.5 45.5 37.5 45.5 24C45.5 22.6 45.4 21.3 45.1 20H44.5Z" fill="#FBBC05" />
              <path d="M44.5 20H24V29H35.8C34.7 33.9 30.1 37 24 37C16.8 37 11 31.2 11 24C11 16.8 16.8 11 24 11C27.1 11 29.9 12.1 32.1 14L38.7 7.4C34.7 3.7 29.6 1.5 24 1.5C11.6 1.5 1.5 11.6 1.5 24C1.5 36.4 11.6 46.5 24 46.5C35.5 46.5 45.5 37.5 45.5 24C45.5 22.6 45.4 21.3 45.1 20H44.5Z" fill="#4285F4" />
              <path d="M44.5 20H24V29H35.8C34.7 33.9 30.1 37 24 37C16.8 37 11 31.2 11 24C11 16.8 16.8 11 24 11C27.1 11 29.9 12.1 32.1 14L38.7 7.4C34.7 3.7 29.6 1.5 24 1.5C11.6 1.5 1.5 11.6 1.5 24C1.5 36.4 11.6 46.5 24 46.5C35.5 46.5 45.5 37.5 45.5 24C45.5 22.6 45.4 21.3 45.1 20H44.5Z" fill="#34A853" />
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="text-xs text-center text-slate-400 mt-8">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
