import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/** Map common file extensions to highlight.js language ids. */
const EXT_TO_LANG: Record<string, string> = {
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  m: "objectivec",
  mm: "objectivec",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  php: "php",
  go: "go",
  rs: "rust",
  zig: "zig",
  scala: "scala",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",
  ps1: "powershell",
  bat: "dos",
  yml: "yaml",
  yaml: "yaml",
  json: "json",
  jsonc: "json",
  toml: "ini",
  ini: "ini",
  xml: "xml",
  html: "xml",
  htm: "xml",
  svg: "xml",
  css: "css",
  scss: "scss",
  less: "less",
  md: "markdown",
  markdown: "markdown",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  dockerfile: "dockerfile",
  make: "makefile",
  mk: "makefile",
  vue: "xml",
  lua: "lua",
  r: "r",
  pl: "perl",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  clj: "clojure",
  dart: "dart",
  proto: "protobuf",
  diff: "diff",
  patch: "diff",
  log: "accesslog",
  env: "ini",
  conf: "ini",
};

const TEXT_MIMES = new Set([
  "application/json",
  "application/xml",
  "application/x-sh",
  "application/x-yaml",
  "application/javascript",
  "application/typescript",
]);

/** Decide if a file should be treated as text/code based on mime + filename. */
export function isTextLike(
  mimeType: string | null,
  filename: string
): boolean {
  if (mimeType?.startsWith("text/")) return true;
  if (mimeType && TEXT_MIMES.has(mimeType)) return true;
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && ext in EXT_TO_LANG) return true;
  // Special case: files named "Dockerfile", "Makefile", etc.
  const lowerName = filename.toLowerCase();
  if (lowerName === "dockerfile" || lowerName === "makefile") return true;
  return false;
}

function detectLanguage(filename: string, mimeType: string | null): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && EXT_TO_LANG[ext]) return EXT_TO_LANG[ext];
  const lowerName = filename.toLowerCase();
  if (lowerName === "dockerfile") return "dockerfile";
  if (lowerName === "makefile") return "makefile";
  if (mimeType === "application/json") return "json";
  if (mimeType === "application/xml") return "xml";
  return "plaintext";
}

const MAX_PREVIEW_BYTES = 200_000;

export function CodePreview({
  url,
  filename,
  mimeType,
}: {
  url: string;
  filename: string;
  mimeType: string | null;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("plaintext");
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHighlighted(null);

    (async () => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const sliced =
          buf.byteLength > MAX_PREVIEW_BYTES
            ? buf.slice(0, MAX_PREVIEW_BYTES)
            : buf;
        const text = new TextDecoder("utf-8", { fatal: false }).decode(sliced);
        if (cancelled) return;
        setContent(text);
        setTruncated(buf.byteLength > MAX_PREVIEW_BYTES);

        const lang = detectLanguage(filename, mimeType);
        setLanguage(lang);

        // Lazy-load highlight.js only when we actually need it.
        const hljs = (await import("highlight.js")).default;
        if (cancelled) return;
        const result =
          lang !== "plaintext" && hljs.getLanguage(lang)
            ? hljs.highlight(text, { language: lang, ignoreIllegals: true })
            : hljs.highlightAuto(text);
        setLanguage(result.language || lang);
        setHighlighted(result.value);
      } catch {
        if (!cancelled) setContent("Failed to load preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, filename, mimeType]);

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative">
      {language !== "plaintext" && (
        <div className="absolute top-2 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-black/40 text-white/80 font-mono">
          {language}
        </div>
      )}
      <pre className="text-sm overflow-auto max-h-[70vh] m-0">
        <code
          className={`hljs language-${language} block`}
          {...(highlighted
            ? { dangerouslySetInnerHTML: { __html: highlighted } }
            : { children: content })}
        />
      </pre>
      {truncated && (
        <div className="px-4 py-2 text-xs text-text-muted border-t border-border bg-surface">
          Preview truncated. Download for full content.
        </div>
      )}
    </div>
  );
}
