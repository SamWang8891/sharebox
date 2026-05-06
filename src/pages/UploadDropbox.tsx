import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  File as FileIcon,
  Inbox,
  Loader2,
  Lock,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  formatBytes,
  formatDate,
  getPublicShareDownloadUrl,
  getPublicShareLink,
  isExpired,
  publicShareConfirm,
  publicShareDeleteFile,
  publicShareUpload,
  type PublicShareLink,
  type ShareLinkFile,
} from "../lib/api";

function getFileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function UploadDropbox() {
  const { id } = useParams<{ id: string }>();
  const [link, setLink] = useState<PublicShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getPublicShareLink(id);
      setLink(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load link");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">Link not available</h2>
        <p className="text-sm text-text-muted">
          {error ?? "This link doesn't exist or has been removed."}
        </p>
      </div>
    );
  }

  const isOpen =
    link.status === "open" && !isExpired(link.expiresAt);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Header link={link} />
      {isOpen ? (
        <UploaderView link={link} onChange={reload} />
      ) : (
        <ViewerView link={link} />
      )}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────
function Header({ link }: { link: PublicShareLink }) {
  const expired = link.status === "expired" || isExpired(link.expiresAt);

  let badge;
  if (link.status === "confirmed") {
    badge = (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
        <CheckCircle2 className="w-3 h-3" /> View only
      </span>
    );
  } else if (expired) {
    badge = (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-danger/10 text-danger">
        <Lock className="w-3 h-3" /> Closed
      </span>
    );
  } else {
    badge = (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500">
        <Inbox className="w-3 h-3" /> Open
      </span>
    );
  }

  return (
    <div className="bg-surface-light rounded-xl border border-border p-4 sm:p-5 mb-6">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="text-lg font-semibold break-words">
          {link.label || "Upload link"}
        </h1>
        {badge}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        <span>
          {link.fileCount}{" "}
          {link.fileCount === 1 ? "file" : "files"}
          {link.maxFiles ? ` / ${link.maxFiles}` : ""}
        </span>
        <span>
          {formatBytes(link.bytesUsed)}
          {link.maxTotalBytes ? ` / ${formatBytes(link.maxTotalBytes)}` : ""}
        </span>
        {link.allowedExtensions.length > 0 && (
          <span title={link.allowedExtensions.map((e) => `.${e}`).join(", ")}>
            Accepts: {link.allowedExtensions.slice(0, 6).map((e) => `.${e}`).join(", ")}
            {link.allowedExtensions.length > 6 ? ", …" : ""}
          </span>
        )}
        {link.expiresAt && link.status === "open" && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {expired ? "expired" : `closes ${formatDate(link.expiresAt)}`}
          </span>
        )}
        {link.confirmedAt && (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            confirmed {formatDate(link.confirmedAt)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Open mode (uploader UI) ───────────────────────────────────────
function UploaderView({
  link,
  onChange,
}: {
  link: PublicShareLink;
  onChange: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allowedExt = new Set(link.allowedExtensions);

  const clientValidate = (file: File): string | null => {
    if (link.maxFiles !== null && link.fileCount + 1 > link.maxFiles) {
      return `Limit reached (${link.maxFiles} files max)`;
    }
    if (
      link.maxTotalBytes !== null &&
      link.bytesUsed + file.size > link.maxTotalBytes
    ) {
      return "Adding this file exceeds the total size limit";
    }
    if (allowedExt.size > 0) {
      const ext = getFileExt(file.name);
      if (!ext || !allowedExt.has(ext)) {
        return `File type ".${ext || "?"}" not accepted`;
      }
    }
    return null;
  };

  const upload = async (filesIn: FileList | File[]) => {
    const list = Array.from(filesIn);
    if (list.length === 0) return;
    setUploading((prev) => [...prev, ...list.map((f) => f.name)]);
    const newErrors: { name: string; message: string }[] = [];
    for (const file of list) {
      const localErr = clientValidate(file);
      if (localErr) {
        newErrors.push({ name: file.name, message: localErr });
        continue;
      }
      try {
        await publicShareUpload(link.id, file);
      } catch (err: any) {
        newErrors.push({
          name: file.name,
          message: err?.message ?? "Upload failed",
        });
      }
    }
    setUploading((prev) =>
      prev.filter((n) => !list.some((f) => f.name === n))
    );
    if (newErrors.length) setErrors((prev) => [...prev, ...newErrors]);
    onChange();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) upload(e.target.files);
    e.target.value = "";
  };

  const removeFile = async (file: ShareLinkFile) => {
    if (!confirm(`Remove "${file.originalName}"?`)) return;
    try {
      await publicShareDeleteFile(link.id, file.id);
      onChange();
    } catch (err: any) {
      setErrors((prev) => [
        ...prev,
        { name: file.originalName, message: err?.message ?? "Remove failed" },
      ]);
    }
  };

  const confirmDone = async () => {
    if (link.fileCount === 0) {
      setConfirmError("Upload at least one file before confirming.");
      return;
    }
    if (!confirm("Lock this link? You won't be able to add more files after this.")) {
      return;
    }
    setConfirming(true);
    setConfirmError(null);
    try {
      await publicShareConfirm(link.id);
      onChange();
    } catch (err: any) {
      setConfirmError(err?.message ?? "Confirm failed");
    } finally {
      setConfirming(false);
    }
  };

  const accept =
    link.allowedExtensions.length > 0
      ? link.allowedExtensions.map((e) => `.${e}`).join(",")
      : undefined;

  const showCounter =
    link.maxFiles !== null || link.maxTotalBytes !== null;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-primary bg-primary/10"
            : "border-border hover:border-text-muted"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={onSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          <Upload className="w-10 h-10 text-text-muted" />
          <p className="text-text-muted">
            Drop files here or{" "}
            <span className="text-primary">click to browse</span>
          </p>
          {showCounter && (
            <p className="text-xs text-text-muted">
              {link.fileCount}
              {link.maxFiles ? `/${link.maxFiles}` : ""} files ·{" "}
              {formatBytes(link.bytesUsed)}
              {link.maxTotalBytes ? `/${formatBytes(link.maxTotalBytes)}` : ""}
            </p>
          )}
        </div>
      </div>

      {uploading.length > 0 && (
        <div className="bg-surface-light rounded-lg border border-border p-3 space-y-1">
          {uploading.map((n) => (
            <div
              key={n}
              className="flex items-center gap-2 text-xs text-text-muted"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="truncate">Uploading {n}…</span>
            </div>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 space-y-1">
          {errors.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-danger"
            >
              <X className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">{e.name}</span> — {e.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {link.files.length > 0 && (
        <div className="bg-surface-light rounded-xl border border-border p-3">
          <h3 className="text-xs font-medium text-text-muted px-1 mb-2">
            Uploaded ({link.files.length})
          </h3>
          <div className="space-y-1">
            {link.files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface"
              >
                <FileIcon className="w-4 h-4 text-text-muted shrink-0" />
                <span className="text-sm truncate flex-1 min-w-0">
                  {f.originalName}
                </span>
                <span className="text-xs text-text-muted shrink-0">
                  {formatBytes(f.size)}
                </span>
                <button
                  onClick={() => removeFile(f)}
                  className="p-1 rounded hover:bg-surface-light text-danger"
                  title="Remove"
                  aria-label="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmError && (
        <div className="text-sm text-danger">{confirmError}</div>
      )}

      <button
        onClick={confirmDone}
        disabled={confirming || link.fileCount === 0}
        className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-3 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
      >
        {confirming ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Check className="w-4 h-4" />
        )}
        Done — lock & share
      </button>
      <p className="text-[11px] text-text-muted text-center">
        Once you click Done, no more files can be added and the link becomes a
        view-only download page.
      </p>
    </div>
  );
}

// ── Confirmed/closed mode (viewer UI) ─────────────────────────────
function ViewerView({ link }: { link: PublicShareLink }) {
  if (link.status !== "confirmed") {
    return (
      <div className="bg-surface-light rounded-xl border border-border p-8 text-center">
        <Lock className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-60" />
        <p className="text-sm text-text-muted">
          This upload link is closed and was never confirmed. Ask the owner for
          a new one.
        </p>
      </div>
    );
  }
  if (link.files.length === 0) {
    return (
      <div className="bg-surface-light rounded-xl border border-border p-8 text-center">
        <Inbox className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-60" />
        <p className="text-sm text-text-muted">No files in this bundle.</p>
      </div>
    );
  }
  return (
    <div className="bg-surface-light rounded-xl border border-border p-3">
      <div className="space-y-1">
        {link.files.map((f) => (
          <a
            key={f.id}
            href={getPublicShareDownloadUrl(link.id, f.id)}
            download={f.originalName}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface group"
          >
            <FileIcon className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-sm truncate flex-1 min-w-0">
              {f.originalName}
            </span>
            <span className="text-xs text-text-muted shrink-0">
              {formatBytes(f.size)}
            </span>
            <Download className="w-4 h-4 text-text-muted opacity-60 group-hover:opacity-100 group-hover:text-primary shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}
