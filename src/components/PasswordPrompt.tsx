import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";

export function PasswordPrompt({
  onSubmit,
  error,
}: {
  onSubmit: (password: string) => void;
  error?: string | null;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    onSubmit(password);
    // Loading state will be reset by parent when error changes
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-surface-light rounded-xl p-8 border border-border text-center">
        <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-yellow-500" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Password Required</h2>
        <p className="text-sm text-text-muted mb-6">
          This file is password protected. Enter the password to access it.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            autoFocus
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
