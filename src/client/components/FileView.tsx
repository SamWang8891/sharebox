import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch, FileMetadata } from '../api'

export default function FileView() {
  const { shortId } = useParams<{ shortId: string }>()
  const navigate = useNavigate()
  const [file, setFile] = useState<FileMetadata | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetchFile()
  }, [shortId])

  const fetchFile = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<FileMetadata>(`/files/${shortId}`)
      setFile(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setDownloading(true)
    setError(null)

    try {
      const res = await fetch(`/api/files/${shortId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to download file')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file?.filename || 'download'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center pt-20 gap-4 animate-pulse">
        <div className="w-16 h-16 bg-slate-200 rounded-2xl" />
        <div className="w-48 h-6 bg-slate-200 rounded" />
      </div>
    )
  }

  if (error && !file) {
    return (
      <div className="max-w-md mx-auto text-center pt-20">
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!file) return null

  const isImage = file.mime_type?.startsWith('image/')
  const isText = file.mime_type?.startsWith('text/') || file.mime_type === 'application/json'

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="card space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold break-all">{file.filename}</h1>
              <p className="text-slate-500 text-sm">
                {(file.size / 1024 / 1024).toFixed(2)} MB &bull; Uploaded {new Date(file.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {file.is_protected ? (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <p className="text-slate-600 font-medium">This file is password protected.</p>
            <form onSubmit={handleDownload} className="flex gap-2">
              <input
                type="password"
                className="input flex-1"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                disabled={downloading || !password}
                className="btn btn-primary whitespace-nowrap"
              >
                {downloading ? 'Downloading...' : 'Unlock & Download'}
              </button>
            </form>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {isImage && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-inner">
                <img 
                  src={`/api/files/${shortId}/download`} 
                  alt={file.filename} 
                  className="w-full h-auto max-h-[600px] object-contain"
                />
              </div>
            )}
            
            <div className="flex justify-center">
              <button
                onClick={() => handleDownload()}
                disabled={downloading}
                className="btn btn-primary py-3 px-8 text-lg"
              >
                {downloading ? 'Downloading...' : 'Download File'}
              </button>
            </div>
          </div>
        )}

        <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Expires</p>
            <p className="text-sm font-medium">
              {file.expires_at ? new Date(file.expires_at).toLocaleString() : 'Never'}
            </p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Downloads</p>
            <p className="text-sm font-medium">{file.downloads || 0}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
