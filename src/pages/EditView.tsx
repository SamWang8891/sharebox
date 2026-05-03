import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import { startEditSession } from "../lib/api";

export function EditView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{
    actionUrl: string;
    wopiSrc: string;
    accessToken: string;
    accessTokenTtl: number;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    startEditSession(id)
      .then(setSession)
      .catch((err) => setError(err.message || "Could not start edit session"))
      .finally(() => setLoading(false));
  }, [id]);

  // Collabora wants the access_token POSTed via a form submitted into the
  // iframe (so the token isn't logged in browser/server access logs as a
  // query param). Auto-submit on render.
  useEffect(() => {
    if (session && formRef.current) {
      formRef.current.submit();
    }
  }, [session]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-sm text-text-muted">Opening editor…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">Cannot open editor</h2>
        <p className="text-sm text-text-muted mb-6">
          {error ?? "Unknown error"}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 bg-surface-light hover:bg-surface-lighter text-sm px-4 py-2 rounded-lg border border-border transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    );
  }

  // Append WOPISrc as a query param. Discovery action urlsrc may end in
  // "?" or "&" already (Collabora convention); handle each cleanly.
  const wopiParam = `WOPISrc=${encodeURIComponent(session.wopiSrc)}`;
  let iframeSrc: string;
  if (session.actionUrl.endsWith("?") || session.actionUrl.endsWith("&")) {
    iframeSrc = `${session.actionUrl}${wopiParam}`;
  } else if (session.actionUrl.includes("?")) {
    iframeSrc = `${session.actionUrl}&${wopiParam}`;
  } else {
    iframeSrc = `${session.actionUrl}?${wopiParam}`;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-surface z-40">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-surface-light/70 backdrop-blur-md"
           style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Done
        </button>
        <span className="text-xs text-text-muted">Edits save automatically</span>
      </div>

      {/* Hidden form posts the access_token into the iframe on load */}
      <form
        ref={formRef}
        action={iframeSrc}
        method="post"
        target="collabora-frame"
        style={{ display: "none" }}
      >
        <input name="access_token" value={session.accessToken} readOnly />
        <input
          name="access_token_ttl"
          value={String(session.accessTokenTtl)}
          readOnly
        />
      </form>

      <iframe
        name="collabora-frame"
        title="Collabora Office"
        className="flex-1 w-full border-0"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
