import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logout } from '../auth'

interface LayoutProps {
  user: { email: string; isAdmin?: boolean } | null
  children: React.ReactNode
}

export default function Layout({ user, children }: LayoutProps) {
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg group-hover:bg-blue-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">ShareBox</span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-6">
            {user ? (
              <>
                <Link to="/dashboard" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
                  My Files
                </Link>
                {user.isAdmin && (
                  <Link to="/admin" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
                    Admin
                  </Link>
                )}
                <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-200">
                  <span className="hidden sm:inline-block text-xs font-medium text-slate-500 max-w-[120px] truncate">
                    {user.email}
                  </span>
                  <button 
                    onClick={handleLogout}
                    className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary text-sm py-1.5">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} ShareBox &bull; Secure File Sharing
          </p>
        </div>
      </footer>
    </div>
  )
}
