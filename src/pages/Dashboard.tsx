import { useState, useEffect, useCallback } from "react";
import { FileUpload } from "../components/FileUpload";
import { FileCard } from "../components/FileCard";
import { listFiles, type FileInfo } from "../lib/api";
import { Loader2, Inbox } from "lucide-react";

export function Dashboard() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    try {
      const data = await listFiles();
      setFiles(data);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Upload</h1>
      <FileUpload onUploaded={loadFiles} />

      <div className="mt-10">
        <h2 className="text-lg font-semibold mb-4">
          Your Files
          {files.length > 0 && (
            <span className="text-text-muted font-normal text-sm ml-2">
              ({files.length})
            </span>
          )}
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <Inbox className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No files yet. Upload one above!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <FileCard key={file.id} file={file} onDeleted={loadFiles} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
