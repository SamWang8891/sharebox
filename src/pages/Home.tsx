import { Upload, Link, Lock, Clock, Box } from "lucide-react";
import { signIn } from "../lib/auth-client";
import type { CurrentUser } from "../lib/api";
import { useNavigate } from "react-router-dom";

export function Home({ user }: { user: CurrentUser | null }) {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
          <Box className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-4">ShareBox</h1>
        <p className="text-lg text-text-muted max-w-md mx-auto">
          Simple, self-hosted file sharing. Upload files and share them with a
          link.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        {[
          {
            icon: Upload,
            title: "Quick Upload",
            desc: "Drag & drop or click to upload any file up to 80 MB",
          },
          {
            icon: Link,
            title: "Share Links",
            desc: "Get a short, shareable link for every upload",
          },
          {
            icon: Lock,
            title: "Password Protection",
            desc: "Optionally protect files with a password",
          },
          {
            icon: Clock,
            title: "Auto-Expiry",
            desc: "Set files to automatically expire after a set time",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="bg-surface-light rounded-xl p-5 border border-border"
          >
            <Icon className="w-5 h-5 text-primary mb-2" />
            <h3 className="font-medium text-sm mb-1">{title}</h3>
            <p className="text-xs text-text-muted">{desc}</p>
          </div>
        ))}
      </div>

      <div className="text-center">
        {user ? (
          user.isApproved ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
            >
              Go to Dashboard
            </button>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 max-w-sm mx-auto">
              <p className="text-yellow-500 font-medium mb-1">
                Pending Approval
              </p>
              <p className="text-sm text-text-muted">
                You're signed in as {user.email}, but your account hasn't been
                approved yet. Contact the admin for access.
              </p>
            </div>
          )
        ) : (
          <button
            onClick={() => signIn.social({ provider: "google" })}
            className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2"
          >
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}
