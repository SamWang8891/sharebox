import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy,
  Check,
  Trash2,
  Download,
  Lock,
  Clock,
  Eye,
  FileText,
  Image,
  Film,
  Music,
  FileArchive,
  File,
} from "lucide-react";
import { deleteFile, formatBytes, formatDate, isExpired, getRawFileUrl } from "../lib/api";
import type { FileInfo } from "../lib/api";

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Film;
  if (mimeType.startsWith("audio/")) return Music;
  if (mimeType.startsWith("text/")) return FileText;
  if (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("rar")
  )
    return FileArchive;
  return File;
}

export function FileCard({
  file,
  onDeleted,
}: {
  file: FileInfo;
  onDeleted: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const expired = isExpired(file.expiresAt);
  const Icon = getFileIcon(file.mimeType);

  const copyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/f/${file.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${file.originalName}"?`)) return;
    setDeleting(true);
    try {
      await deleteFile(file.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`group bg-surface-light rounded-xl border transition-colors ${
        expired
          ? "border-danger/30 opacity-60"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <Link
          to={`/f/${file.id}`}
          className="flex items-start gap-3 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg"
          aria-label={`Preview ${file.originalName}`}
        >
          <div className="p-2 bg-surface rounded-lg shrink-0">
            <Icon className="w-5 h-5 text-text-muted" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{file.originalName}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-text-muted">
              <span>{formatBytes(file.size)}</span>
              <span className="flex items-center gap-1" title="Downloads">
                <Eye className="w-3 h-3" />
                {file.accessCount}{" "}
                {file.accessCount === 1 ? "download" : "downloads"}
              </span>
              {file.hasPassword && (
                <span className="flex items-center gap-1 text-yellow-500">
                  <Lock className="w-3 h-3" />
                  Protected
                </span>
              )}
              {file.expiresAt && (
                <span
                  className={`flex items-center gap-1 ${expired ? "text-danger" : ""}`}
                >
                  <Clock className="w-3 h-3" />
                  {expired ? "Expired" : formatDate(file.expiresAt)}
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-1">
              {formatDate(file.createdAt)}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-0.5 shrink-0">
          {file.hasPassword ? (
            <Link
              to={`/f/${file.id}`}
              className="p-2 rounded-lg hover:bg-surface transition-colors"
              title="Open to download (password required)"
              aria-label="Download"
            >
              <Download className="w-4 h-4 text-text-muted" />
            </Link>
          ) : (
            <a
              href={getRawFileUrl(file.id)}
              download={file.originalName}
              className="p-2 rounded-lg hover:bg-surface transition-colors"
              title="Download"
              aria-label="Download"
            >
              <Download className="w-4 h-4 text-text-muted" />
            </a>
          )}
          <button
            onClick={copyLink}
            className="p-2 rounded-lg hover:bg-surface transition-colors"
            title="Copy link"
            aria-label="Copy link"
          >
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-text-muted" />
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded-lg hover:bg-surface transition-colors"
            title="Delete"
            aria-label="Delete"
          >
            <Trash2
              className={`w-4 h-4 ${deleting ? "text-text-muted" : "text-danger"}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
