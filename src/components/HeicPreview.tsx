import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Download } from "lucide-react";

export function isHeic(mimeType: string | null, filename: string): boolean {
  if (
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    mimeType === "image/heic-sequence" ||
    mimeType === "image/heif-sequence"
  ) {
    return true;
  }
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext === "heic" || ext === "heif";
}

export function HeicPreview({
  url,
  alt,
}: {
  url: string;
  alt: string;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setImgUrl(null);

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch image");
        const blob = await res.blob();
        // Lazy-load the converter; only fetched when viewing a HEIC.
        const { heicTo } = await import("heic-to");
        if (cancelled) return;
        const converted = await heicTo({
          blob,
          type: "image/jpeg",
          quality: 0.9,
        });
        objectUrl = URL.createObjectURL(converted);
        if (!cancelled) setImgUrl(objectUrl);
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message || String(err);
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-sm text-text-muted">Decoding HEIC…</p>
        <p className="text-xs text-text-muted">May take a few seconds.</p>
      </div>
    );
  }

  if (error || !imgUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-danger" />
        <p className="text-sm font-medium">Could not preview HEIC</p>
        <p className="text-xs text-text-muted max-w-md break-words">
          {error || "Unsupported HEIC variant."} Some HEIC files (especially
          newer iPhone formats or HEIF sequences) can't be decoded in the
          browser. Download to view in your OS's native viewer.
        </p>
        <a
          href={url}
          download={alt}
          className="mt-2 inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Download
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4 bg-black/20">
      <img
        src={imgUrl}
        alt={alt}
        className="max-w-full max-h-[70vh] object-contain rounded"
      />
    </div>
  );
}
