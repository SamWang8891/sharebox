import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Download,
  Loader2,
  AlertTriangle,
  Clock,
  Eye,
  FileText,
} from "lucide-react";
import { PasswordPrompt } from "../components/PasswordPrompt";
import { CodePreview, isTextLike } from "../components/CodePreview";
import "highlight.js/styles/github-dark.css";
import {
  getFileInfo,
  verifyFilePassword,
  getRawFileUrl,
  formatBytes,
  formatDate,
  type FileInfo,
} from "../lib/api";

export function FileView() {
  const { id } = useParams<{ id: string }>();
  const [file, setFile] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getFileInfo(id)
      .then(setFile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePasswordSubmit = async (password: string) => {
    if (!id) return;
    setPasswordError(null);
    try {
      const { token } = await verifyFilePassword(id, password);
      setAccessToken(token);
    } catch (err: any) {
      setPasswordError(err.message || "Incorrect password");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">
          {error === "File has expired" ? "File Expired" : "File Not Found"}
        </h2>
        <p className="text-sm text-text-muted">
          {error || "This file doesn't exist or has been removed."}
        </p>
      </div>
    );
  }

  if (file.hasPassword && !accessToken) {
    return (
      <div className="px-4 py-20">
        <PasswordPrompt onSubmit={handlePasswordSubmit} error={passwordError} />
      </div>
    );
  }

  const rawUrl = getRawFileUrl(file.id, accessToken ?? undefined);
  const isImage = file.mimeType?.startsWith("image/");
  const isVideo = file.mimeType?.startsWith("video/");
  const isAudio = file.mimeType?.startsWith("audio/");
  const isPdf = file.mimeType === "application/pdf";
  const isCode = isTextLike(file.mimeType, file.originalName);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-surface-light rounded-xl p-6 border border-border mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold truncate">
              {file.originalName}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-text-muted">
              <span>{formatBytes(file.size)}</span>
              <span>{file.mimeType}</span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {file.accessCount}{" "}
                {file.accessCount === 1 ? "download" : "downloads"}
              </span>
              {file.expiresAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Expires {formatDate(file.expiresAt)}
                </span>
              )}
            </div>
          </div>

          <a
            href={rawUrl}
            download={file.originalName}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        </div>
      </div>

      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        {isImage && (
          <div className="flex items-center justify-center p-4 bg-black/20">
            <img
              src={rawUrl}
              alt={file.originalName}
              className="max-w-full max-h-[70vh] object-contain rounded"
            />
          </div>
        )}

        {isVideo && (
          <video src={rawUrl} controls className="w-full max-h-[70vh]" />
        )}

        {isAudio && (
          <div className="p-8 flex justify-center">
            <audio src={rawUrl} controls className="w-full max-w-md" />
          </div>
        )}

        {isPdf && (
          <iframe
            src={rawUrl}
            className="w-full h-[70vh]"
            title={file.originalName}
          />
        )}

        {!isImage && !isVideo && !isAudio && !isPdf && isCode && (
          <CodePreview
            url={rawUrl}
            filename={file.originalName}
            mimeType={file.mimeType}
          />
        )}

        {!isImage && !isVideo && !isAudio && !isPdf && !isCode && (
          <div className="p-12 text-center text-text-muted">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              Preview not available. Click download to get the file.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
