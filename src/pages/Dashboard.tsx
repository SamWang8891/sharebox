import { useState, useEffect, useCallback } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { FileUpload } from "../components/FileUpload";
import { FileCard } from "../components/FileCard";
import { ShareLinkForm } from "../components/ShareLinkForm";
import { ShareLinkCard } from "../components/ShareLinkCard";
import {
  getConfig,
  listFiles,
  listShareLinks,
  type AppConfig,
  type FileInfo,
  type ShareLink,
} from "../lib/api";

export function Dashboard() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [config, setConfig] = useState<AppConfig | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const data = await listFiles();
      setFiles(data);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  const loadLinks = useCallback(async () => {
    try {
      const data = await listShareLinks();
      setShareLinks(data);
    } catch (err) {
      console.error("Failed to load share links:", err);
    } finally {
      setLinksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
    loadLinks();
    getConfig()
      .then(setConfig)
      .catch(() => setConfig({ pikaEnabled: false, maxUploadSize: 0 }));
  }, [loadFiles, loadLinks]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-12">
      <section>
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

          {filesLoading ? (
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
      </section>

      <section>
        <h1 className="text-2xl font-bold mb-2">Upload links</h1>
        <p className="text-sm text-text-muted mb-6">
          Create a link that lets other people upload files into your account
          without signing in. Once they confirm, the link locks and serves the
          files for download.
        </p>

        <ShareLinkForm
          onCreated={(link) => setShareLinks((prev) => [link, ...prev])}
        />

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">
            Your links
            {shareLinks.length > 0 && (
              <span className="text-text-muted font-normal text-sm ml-2">
                ({shareLinks.length})
              </span>
            )}
          </h2>
          {linksLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
            </div>
          ) : shareLinks.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No upload links yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shareLinks.map((link) => (
                <ShareLinkCard
                  key={link.id}
                  link={link}
                  pikaEnabled={!!config?.pikaEnabled}
                  onDeleted={loadLinks}
                  onUpdated={(updated) =>
                    setShareLinks((prev) =>
                      prev.map((l) => (l.id === updated.id ? updated : l))
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
