import { useState, useEffect } from 'react'
import { apiFetch, UserStats } from '../api'

interface AllowedUser {
  id: number
  email: string
  added_by: string
  created_at: string
}

export default function AdminPanel() {
  const [users, setUsers] = useState<AllowedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<AllowedUser[]>('/admin/users')
      setUsers(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newEmail.includes('@')) return

    setAdding(true)
    setError(null)
    try {
      await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail }),
      })
      setNewEmail('')
      fetchUsers()
    } catch (err: any) {
      setError(`Failed to add user: ${err.message}`)
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveUser = async (id: number) => {
    if (!confirm('Are you sure you want to remove this user from the allowed list?')) return

    setRemoving(id)
    try {
      await apiFetch(`/admin/users/${id}`, { method: 'DELETE' })
      setUsers(users.filter(u => u.id !== id))
    } catch (err: any) {
      alert(`Remove failed: ${err.message}`)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold tracking-tight">Admin Panel</h1>
        <div className="bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-sm font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Admin Access
        </div>
      </div>

      <div className="card space-y-6">
        <h2 className="text-xl font-bold">Add Authorized Uploader</h2>
        <form onSubmit={handleAddUser} className="flex gap-3">
          <input
            type="email"
            className="input flex-1"
            placeholder="Enter user email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={adding || !newEmail}
            className="btn btn-primary px-8 whitespace-nowrap"
          >
            {adding ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Add User'
            )}
          </button>
        </form>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      <div className="card overflow-hidden !p-0">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold">Authorized Uploaders</h2>
        </div>
        
        {loading ? (
          <div className="p-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No authorized users yet. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">User Email</th>
                  <th className="px-6 py-4">Added By</th>
                  <th className="px-6 py-4">Date Added</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{user.added_by}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        disabled={removing === user.id}
                        onClick={() => handleRemoveUser(user.id)}
                        className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1 ml-auto"
                      >
                        {removing === user.id ? (
                          <div className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
                        ) : (
                          'Remove'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
