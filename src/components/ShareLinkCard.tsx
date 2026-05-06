import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  FileX,
  Inbox,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  deleteShareLink,
  formatBytes,
  formatDate,
  isExpired,
  shortenShareLink,
  type ShareLink,
} from "../lib/api";
import { LinkActions } from "./LinkActions";

export function ShareLinkCard({
  link,
  pikaEnabled,
  onDeleted,
  onUpdated,
}: {
  link: ShareLink;
  pikaEnabled: boolean;
  onDeleted: () => void;
  onUpdated: (link: ShareLink) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const expired =
    link.status === "expired" ||
    (link.status === "open" && isExpired(link.expiresAt));

  const fullUrl = `${window.location.origin}${link.url}`;

  const handleDelete = async () => {
    if (
      !confirm(
        `Delete this upload link${
          link.fileCount > 0
            ? ` and the ${link.fileCount} file${
                link.fileCount === 1 ? "" : "s"
              } uploaded into it`
            : ""
        }?`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteShareLink(link.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  const handleShorten = async () => {
    const { shortUrl } = await shortenShareLink(link.id);
    onUpdated({ ...link, shortUrl });
    return shortUrl;
  };

  const StatusBadge = () => {
    if (expired) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-danger/10 text-danger">
          <FileX className="w-3 h-3" /> Expired
        </span>
      );
    }
    if (link.status === "confirmed") {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
          <CheckCircle2 className="w-3 h-3" /> Confirmed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500">
        <Inbox className="w-3 h-3" /> Open
      </span>
    );
  };

  return (
    <div className="bg-surface-light rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-sm truncate">
              {link.label || "Upload link"}
            </p>
            <StatusBadge />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
            <span>
              {link.fileCount}{" "}
              {link.fileCount === 1 ? "file" : "files"}
              {link.maxFiles ? ` / ${link.maxFiles}` : ""}
            </span>
            <span>
              {formatBytes(link.bytesUsed)}
              {link.maxTotalBytes
                ? ` / ${formatBytes(link.maxTotalBytes)}`
                : ""}
            </span>
            {link.allowedExtensions.length > 0 && (
              <span title={link.allowedExtensions.map((e) => `.${e}`).join(", ")}>
                {link.allowedExtensions.length} ext
              </span>
            )}
            {link.expiresAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {expired ? "expired" : formatDate(link.expiresAt)}
              </span>
            )}
            <span>created {formatDate(link.createdAt)}</span>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 rounded-lg hover:bg-surface transition-colors shrink-0"
          title="Delete link"
          aria-label="Delete link"
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
          ) : (
            <Trash2 className="w-4 h-4 text-danger" />
          )}
        </button>
      </div>

      <LinkActions
        url={fullUrl}
        title={link.label || "ShareBox upload link"}
        shareText={
          link.status === "confirmed"
            ? "Files shared with you on ShareBox"
            : "Upload your files here"
        }
        pikaEnabled={pikaEnabled}
        shortUrl={link.shortUrl}
        onShorten={handleShorten}
      />
    </div>
  );
}
