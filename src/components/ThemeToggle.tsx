import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemeMode } from "../lib/theme";

const OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: "light", icon: Sun, label: "Light" },
  { mode: "auto", icon: Monitor, label: "System" },
  { mode: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <div className="flex items-center bg-surface-light border border-border rounded-lg p-0.5">
      {OPTIONS.map(({ mode: m, icon: Icon, label }) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          aria-label={label}
          title={label}
          className={`p-1.5 rounded transition-colors ${
            mode === m
              ? "bg-primary text-white"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}
