import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

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
        // Lazy-load the converter; ~700 KB, only fetched when viewing a HEIC.
        const heic2any = (await import("heic2any")).default;
        if (cancelled) return;
        const converted = (await heic2any({
          blob,
          toType: "image/jpeg",
          quality: 0.9,
        })) as Blob | Blob[];
        const result = Array.isArray(converted) ? converted[0] : converted;
        objectUrl = URL.createObjectURL(result);
        if (!cancelled) setImgUrl(objectUrl);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Could not decode HEIC image");
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
      <div className="flex flex-col items-center justify-center p-12 gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-danger" />
        <p className="text-sm text-text-muted">
          {error || "Could not preview HEIC image"}
        </p>
        <p className="text-xs text-text-muted">
          Download to view in a HEIC-capable app.
        </p>
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
