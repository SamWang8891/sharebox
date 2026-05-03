import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "auto" | "light" | "dark";
type Resolved = "light" | "dark";

type Ctx = {
  mode: ThemeMode;
  resolved: Resolved;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "sharebox-theme";

function getSystemTheme(): Resolved {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredMode(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "auto" ? v : "auto";
}

function applyTheme(resolved: Resolved) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [resolved, setResolved] = useState<Resolved>(() =>
    mode === "auto" ? getSystemTheme() : mode
  );

  useEffect(() => {
    const next: Resolved = mode === "auto" ? getSystemTheme() : mode;
    setResolved(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // React to OS theme changes when in auto mode
  useEffect(() => {
    if (mode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next = getSystemTheme();
      setResolved(next);
      applyTheme(next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode: setModeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** Apply stored theme synchronously, before React hydrates, to avoid FOUC. */
export function applyStoredTheme() {
  const mode = readStoredMode();
  const resolved: Resolved =
    mode === "auto" ? getSystemTheme() : (mode as Resolved);
  applyTheme(resolved);
}
