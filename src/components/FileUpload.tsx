import { useState, useCallback, useRef } from "react";
import { Upload, Lock, Clock, X, Check, Loader2 } from "lucide-react";
import { shortenFile, uploadFile, type FileInfo } from "../lib/api";
import { LinkActions } from "./LinkActions";

const EXPIRY_OPTIONS = [
  { label: "1 hour", value: "1" },
  { label: "24 hours", value: "24" },
  { label: "7 days", value: "168" },
  { label: "30 days", value: "720" },
  { label: "Never", value: "never" },
];

export function FileUpload({
  onUploaded,
  pikaEnabled,
}: {
  onUploaded: () => void;
  pikaEnabled: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresIn, setExpiresIn] = useState("never");
  const [result, setResult] = useState<FileInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setResult(null);

      try {
        const info = await uploadFile(file, {
          password: password || undefined,
          expiresIn,
        });
        setResult(info);
        setPassword("");
        onUploaded();
      } catch (err: any) {
        setError(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [password, expiresIn, onUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      e.target.value = "";
    },
    [handleUpload]
  );

  const handleShorten = useCallback(async () => {
    if (!result) throw new Error("No file");
    const { shortUrl } = await shortenFile(result.id);
    setResult({ ...result, shortUrl });
    return shortUrl;
  }, [result]);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all
          ${
            dragOver
              ? "border-primary bg-primary/10"
              : "border-border hover:border-text-muted"
          }
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={onFileSelect}
          className="hidden"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-text-muted">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-text-muted" />
            <p className="text-text-muted">
              Drop a file here or{" "}
              <span className="text-primary">click to browse</span>
            </p>
            <p className="text-xs text-text-muted">Max 80 MB</p>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-surface-light rounded-lg px-3 py-2">
          <Lock className="w-4 h-4 text-text-muted" />
          <input
            type="password"
            placeholder="Password (optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-transparent text-sm outline-none w-40"
          />
        </div>

        <div className="flex items-center gap-2 bg-surface-light rounded-lg px-3 py-2">
          <Clock className="w-4 h-4 text-text-muted" />
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value)}
            className="bg-transparent text-sm outline-none cursor-pointer"
          >
            {EXPIRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-surface-light border border-success/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-5 h-5 text-success shrink-0" />
            <span className="text-sm truncate">{result.originalName}</span>
          </div>
          <LinkActions
            url={`${window.location.origin}/f/${result.id}`}
            title={result.originalName}
            shareText={result.originalName}
            pikaEnabled={pikaEnabled}
            shortUrl={result.shortUrl ?? null}
            onShorten={handleShorten}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-center gap-2">
          <X className="w-5 h-5 text-danger shrink-0" />
          <span className="text-sm text-danger">{error}</span>
        </div>
      )}
    </div>
  );
}
