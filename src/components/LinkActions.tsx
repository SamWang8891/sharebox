import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  Copy,
  Download,
  Link2,
  QrCode,
  Scissors,
  Share2,
  X,
} from "lucide-react";

type ShortenFn = () => Promise<string>;

export function LinkActions({
  url,
  title,
  shareText,
  pikaEnabled,
  shortUrl,
  onShorten,
  className = "",
}: {
  url: string;
  title?: string;
  shareText?: string;
  pikaEnabled?: boolean;
  shortUrl?: string | null;
  onShorten?: ShortenFn;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <UrlRow url={url} title={title} shareText={shareText} icon={<Link2 className="w-3.5 h-3.5" />}>
        {pikaEnabled && onShorten && !shortUrl && (
          <ShortenButton onShorten={onShorten} />
        )}
      </UrlRow>
      {shortUrl && (
        <UrlRow
          url={shortUrl}
          title={title}
          shareText={shareText}
          icon={<Scissors className="w-3.5 h-3.5" />}
          accent
        />
      )}
    </div>
  );
}

function UrlRow({
  url,
  title,
  shareText,
  icon,
  accent,
  children,
}: {
  url: string;
  title?: string;
  shareText?: string;
  icon: React.ReactNode;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
        accent
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-surface-light"
      }`}
    >
      <span className="text-text-muted shrink-0">{icon}</span>
      <span
        className="text-xs sm:text-sm font-mono truncate flex-1 min-w-0"
        title={url}
      >
        {url}
      </span>
      <div className="flex items-center gap-0.5 shrink-0">
        <ShareButton url={url} title={title} text={shareText} />
        <CopyButton url={url} />
        <QrButton url={url} title={title ?? url} />
        {children}
      </div>
    </div>
  );
}

function ShareButton({
  url,
  title,
  text,
}: {
  url: string;
  title?: string;
  text?: string;
}) {
  const [copied, setCopied] = useState(false);
  const supportsShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handle = async () => {
    if (supportsShare) {
      try {
        await navigator.share({ url, title, text });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      onClick={handle}
      className="p-1.5 rounded-md hover:bg-surface transition-colors"
      title={supportsShare ? "Share" : "Copy (share unsupported)"}
      aria-label="Share"
    >
      {copied ? (
        <Check className="w-4 h-4 text-success" />
      ) : (
        <Share2 className="w-4 h-4 text-text-muted" />
      )}
    </button>
  );
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={handle}
      className="p-1.5 rounded-md hover:bg-surface transition-colors"
      title="Copy link"
      aria-label="Copy link"
    >
      {copied ? (
        <Check className="w-4 h-4 text-success" />
      ) : (
        <Copy className="w-4 h-4 text-text-muted" />
      )}
    </button>
  );
}

function QrButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-md hover:bg-surface transition-colors"
        title="Show QR code"
        aria-label="Show QR code"
      >
        <QrCode className="w-4 h-4 text-text-muted" />
      </button>
      {open && <QrModal url={url} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function QrModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const downloadPng = async () => {
    const svg = wrapRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const size = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((png) => {
        if (!png) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(png);
        a.download = `${title.replace(/[^a-z0-9-_]+/gi, "_")}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl border border-border p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">QR Code</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-light text-text-muted"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          ref={wrapRef}
          className="bg-white rounded-xl p-4 flex items-center justify-center"
        >
          <QRCodeSVG value={url} size={240} level="M" includeMargin={false} />
        </div>
        <p className="mt-3 text-xs text-text-muted break-all font-mono">{url}</p>
        <button
          onClick={downloadPng}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm px-3 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Download PNG
        </button>
      </div>
    </div>
  );
}

function ShortenButton({ onShorten }: { onShorten: ShortenFn }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handle = async () => {
    setBusy(true);
    setError(null);
    try {
      await onShorten();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shorten failed");
      setTimeout(() => setError(null), 3000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={handle}
      disabled={busy}
      className="p-1.5 rounded-md hover:bg-surface transition-colors disabled:opacity-50"
      title={error ?? "Create short link"}
      aria-label="Create short link"
    >
      <Scissors
        className={`w-4 h-4 ${error ? "text-danger" : "text-text-muted"} ${busy ? "animate-pulse" : ""}`}
      />
    </button>
  );
}
