import { useState, useEffect } from 'react'
import { apiFetch, FileMetadata } from '../api'
import Upload from './Upload'

export default function Dashboard() {
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchFiles()
  }, [])

  const fetchFiles = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<FileMetadata[]>('/files')
      setFiles(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (shortId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    setDeleting(shortId)
    try {
      await apiFetch(`/files/${shortId}`, { method: 'DELETE' })
      setFiles(files.filter(f => f.short_id !== shortId))
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const handleUploadSuccess = (shortId: string) => {
    setShowUpload(false)
    fetchFiles()
  }

  return (
    <div className="space-y-12 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold tracking-tight">Your Files</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className={`btn ${showUpload ? 'btn-secondary' : 'btn-primary'} flex items-center gap-2 px-6 shadow-lg shadow-blue-500/20`}
        >
          {showUpload ? (
            'Cancel'
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Upload File
            </>
          )}
        </button>
      </div>

      {showUpload && (
        <div className="animate-in zoom-in-95 duration-200">
          <Upload onSuccess={handleUploadSuccess} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center pt-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 text-center">
          <p className="font-bold mb-2">Failed to load files</p>
          <p>{error}</p>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center pt-24 space-y-4">
          <div className="bg-slate-100 p-6 rounded-full w-fit mx-auto text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-xl font-medium text-slate-500">No files yet. Start sharing!</p>
          {!showUpload && (
            <button onClick={() => setShowUpload(true)} className="btn btn-primary">
              Upload First File
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {files.map(file => (
            <div key={file.id} className="card group relative flex flex-col justify-between hover:border-blue-200 hover:shadow-md transition-all">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 text-blue-600 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate" title={file.filename}>
                      {file.filename}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB &bull; {file.downloads} downloads
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-400 uppercase tracking-wider">
                    <span>Short ID: {file.short_id}</span>
                    <span>{new Date(file.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center gap-2">
                    <input
                      readOnly
                      className="bg-transparent text-sm font-medium text-slate-600 flex-1 outline-none truncate"
                      value={`${window.location.origin}/f/${file.short_id}`}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/f/${file.short_id}`)
                        alert('Link copied!')
                      }}
                      className="text-blue-600 hover:text-blue-700 p-1"
                      title="Copy link"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <a
                  href={`/f/${file.short_id}`}
                  target="_blank"
                  className="btn btn-secondary flex-1 py-1.5 text-center text-sm"
                >
                  View
                </a>
                <button
                  disabled={deleting === file.short_id}
                  onClick={() => handleDelete(file.short_id)}
                  className="btn btn-danger py-1.5 px-3 text-sm flex items-center justify-center gap-1.5"
                >
                  {deleting === file.short_id ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
