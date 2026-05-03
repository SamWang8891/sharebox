import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  UserPlus,
  Trash2,
  Loader2,
  Crown,
  UserCheck,
  HardDrive,
} from "lucide-react";
import {
  getAdminUsers,
  addAllowedUser,
  removeAllowedUser,
  getUsage,
  formatBytes,
  type AllowedUsersResponse,
  type UsageResponse,
} from "../lib/api";
import { UsageBar } from "../components/UsageBar";

export function Admin() {
  const [data, setData] = useState<AllowedUsersResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [users, usageData] = await Promise.all([
        getAdminUsers(),
        getUsage(),
      ]);
      setData(users);
      setUsage(usageData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addAllowedUser(email.trim());
      setEmail("");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userEmail: string) => {
    if (!confirm(`Remove ${userEmail}?`)) return;
    try {
      await removeAllowedUser(userEmail);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>

      {/* Usage / quotas */}
      {usage && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-wide flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5" />
            Usage
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <UsageBar
              label="Storage"
              used={usage.usage.storageBytes}
              limit={usage.limits.maxStorageBytes}
              formatter={formatBytes}
            />
            <UsageBar
              label="Downloads"
              used={usage.usage.totalDownloads}
              limit={usage.limits.maxDownloads}
            />
            <UsageBar
              label="Bandwidth (est.)"
              used={usage.usage.bandwidthBytes}
              limit={usage.limits.maxBandwidthBytes}
              formatter={formatBytes}
            />
            <UsageBar
              label="Files"
              used={usage.usage.fileCount}
              limit={null}
            />
          </div>
        </section>
      )}

      {/* Add user form */}
      <form onSubmit={handleAdd} className="mb-8">
        <label className="block text-sm font-medium mb-2">
          Add Allowed User
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
          />
          <button
            type="submit"
            disabled={adding || !email.trim()}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            {adding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            Add
          </button>
        </div>
        {error && <p className="text-sm text-danger mt-2">{error}</p>}
      </form>

      {/* Admin list */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-wide">
          Admins (from env)
        </h2>
        <div className="space-y-1">
          {data?.admins.map((adminEmail) => (
            <div
              key={adminEmail}
              className="flex items-center gap-2 bg-surface-light rounded-lg px-4 py-2.5 border border-border"
            >
              <Crown className="w-4 h-4 text-yellow-500" />
              <span className="text-sm">{adminEmail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Allowed users list */}
      <div>
        <h2 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-wide">
          Allowed Users
        </h2>
        {data?.allowedUsers.length === 0 ? (
          <p className="text-sm text-text-muted py-4">
            No additional users added yet.
          </p>
        ) : (
          <div className="space-y-1">
            {data?.allowedUsers.map((u) => (
              <div
                key={u.email}
                className="flex items-center justify-between bg-surface-light rounded-lg px-4 py-2.5 border border-border"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-success" />
                  <span className="text-sm">{u.email}</span>
                </div>
                <button
                  onClick={() => handleRemove(u.email)}
                  className="p-1 hover:bg-surface rounded transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4 text-danger" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
