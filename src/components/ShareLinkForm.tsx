import { useState } from "react";
import { Inbox, Loader2, Plus, X } from "lucide-react";
import {
  createShareLink,
  formatBytes,
  type ShareLink,
} from "../lib/api";

const EXTENSION_PRESETS: { label: string; ext: string[] }[] = [
  { label: "Images", ext: ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"] },
  { label: "Documents", ext: ["pdf", "doc", "docx", "txt", "rtf", "odt"] },
  { label: "Spreadsheets", ext: ["xls", "xlsx", "csv", "ods"] },
  { label: "Slides", ext: ["ppt", "pptx", "odp"] },
  { label: "Video", ext: ["mp4", "mov", "avi", "mkv", "webm"] },
  { label: "Audio", ext: ["mp3", "wav", "ogg", "m4a", "flac"] },
  { label: "Archives", ext: ["zip", "rar", "tar", "gz", "7z"] },
];

const EXPIRY_OPTIONS = [
  { label: "1 hour", value: "1" },
  { label: "24 hours", value: "24" },
  { label: "7 days", value: "168" },
  { label: "30 days", value: "720" },
  { label: "Never", value: "never" },
];

const SIZE_PRESETS = [
  { label: "10 MB", value: 10 * 1024 * 1024 },
  { label: "100 MB", value: 100 * 1024 * 1024 },
  { label: "500 MB", value: 500 * 1024 * 1024 },
  { label: "1 GB", value: 1024 * 1024 * 1024 },
];

function normalizeExt(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\.+/, "");
}

export function ShareLinkForm({
  onCreated,
}: {
  onCreated: (link: ShareLink) => void;
}) {
  const [label, setLabel] = useState("");
  const [maxFiles, setMaxFiles] = useState<string>("10");
  const [maxTotalBytes, setMaxTotalBytes] = useState<number | null>(
    100 * 1024 * 1024
  );
  const [presetSelected, setPresetSelected] = useState<Set<string>>(new Set());
  const [customExts, setCustomExts] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState("");
  const [expiresIn, setExpiresIn] = useState("168");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePreset = (label: string) => {
    setPresetSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const addCustomExt = () => {
    const parts = customInput
      .split(/[\s,]+/)
      .map(normalizeExt)
      .filter(Boolean);
    if (parts.length === 0) return;
    setCustomExts((prev) => {
      const next = new Set(prev);
      for (const p of parts) next.add(p);
      return next;
    });
    setCustomInput("");
  };

  const removeCustomExt = (ext: string) => {
    setCustomExts((prev) => {
      const next = new Set(prev);
      next.delete(ext);
      return next;
    });
  };

  const onCustomKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCustomExt();
    }
  };

  const buildExtList = (): string[] => {
    const all = new Set<string>();
    for (const preset of EXTENSION_PRESETS) {
      if (presetSelected.has(preset.label)) {
        for (const e of preset.ext) all.add(e);
      }
    }
    for (const e of customExts) all.add(e);
    return [...all];
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const numFiles = parseInt(maxFiles, 10);
      const link = await createShareLink({
        label: label.trim() || undefined,
        maxFiles:
          Number.isFinite(numFiles) && numFiles > 0 ? numFiles : null,
        maxTotalBytes,
        allowedExtensions: buildExtList(),
        expiresIn,
      });
      onCreated(link);
      // Reset
      setLabel("");
      setPresetSelected(new Set());
      setCustomExts(new Set());
    } catch (err: any) {
      setError(err?.message ?? "Failed to create link");
    } finally {
      setSubmitting(false);
    }
  };

  const totalExtCount = buildExtList().length;

  return (
    <form
      onSubmit={submit}
      className="bg-surface-light rounded-xl border border-border p-4 sm:p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <Inbox className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Create upload link</h3>
      </div>
      <p className="text-xs text-text-muted">
        Anyone with this link can upload files (no sign-in required) until they
        click <span className="font-medium">Done</span> — after that the link
        flips to view-only.
      </p>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          Label (optional)
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Class submissions, vacation photos"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">
            Max files
          </label>
          <input
            type="number"
            min={1}
            value={maxFiles}
            onChange={(e) => setMaxFiles(e.target.value)}
            placeholder="Unlimited"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">
            Total size cap
          </label>
          <select
            value={maxTotalBytes ?? ""}
            onChange={(e) =>
              setMaxTotalBytes(
                e.target.value ? parseInt(e.target.value, 10) : null
              )
            }
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">No limit</option>
            {SIZE_PRESETS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          Allowed file types
          <span className="ml-2 text-text-muted/70">
            ({totalExtCount === 0 ? "any" : `${totalExtCount} extensions`})
          </span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {EXTENSION_PRESETS.map((p) => {
            const active = presetSelected.has(p.label);
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => togglePreset(p.label)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-primary text-white border-primary"
                    : "bg-surface border-border hover:border-text-muted"
                }`}
                title={p.ext.map((e) => `.${e}`).join(", ")}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {[...customExts].map((ext) => (
            <span
              key={ext}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary"
            >
              .{ext}
              <button
                type="button"
                onClick={() => removeCustomExt(ext)}
                className="hover:text-danger"
                aria-label={`Remove ${ext}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-full pl-2 pr-1 py-0.5">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={onCustomKey}
              placeholder="Add custom (e.g. .psd)"
              className="bg-transparent text-xs outline-none w-32"
            />
            <button
              type="button"
              onClick={addCustomExt}
              className="p-1 rounded-full hover:bg-surface-light text-text-muted"
              aria-label="Add custom extension"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-text-muted">
          Leave empty to allow any file type.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          Link expires
        </label>
        <select
          value={expiresIn}
          onChange={(e) => setExpiresIn(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {EXPIRY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] text-text-muted">
          Once confirmed, the view page stays available even after expiry — the
          expiry only stops further uploads.
        </p>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          {maxTotalBytes ? formatBytes(maxTotalBytes) : "no"} cap
          {maxFiles ? ` · ${maxFiles} files max` : " · unlimited files"}
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="bg-primary hover:bg-primary-hover text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Create link
        </button>
      </div>
    </form>
  );
}
