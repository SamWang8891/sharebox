import { useState } from "react";
import {
  Copy,
  Check,
  Trash2,
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
import { deleteFile, formatBytes, formatDate, isExpired } from "../lib/api";
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

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/f/${file.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
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
      className={`bg-surface-light rounded-xl p-4 border transition-colors ${
        expired ? "border-danger/30 opacity-60" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-surface rounded-lg shrink-0">
          <Icon className="w-5 h-5 text-text-muted" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{file.originalName}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-text-muted">
            <span>{formatBytes(file.size)}</span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {file.accessCount}
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

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={copyLink}
            className="p-1.5 rounded-lg hover:bg-surface transition-colors"
            title="Copy link"
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
            className="p-1.5 rounded-lg hover:bg-surface transition-colors"
            title="Delete"
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
