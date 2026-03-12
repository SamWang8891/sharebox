import { Link } from "react-router-dom";
import { Upload, Shield, LogOut, LogIn, Box } from "lucide-react";
import type { CurrentUser } from "../lib/api";
import { signIn, signOut } from "../lib/auth-client";

export function Navbar({ user }: { user: CurrentUser | null }) {
  return (
    <nav className="border-b border-border bg-surface-light/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-lg hover:text-primary transition-colors"
        >
          <Box className="w-5 h-5 text-primary" />
          ShareBox
        </Link>

        <div className="flex items-center gap-3">
          {user?.isApproved && (
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              <Upload className="w-4 h-4" />
              Dashboard
            </Link>
          )}

          {user?.isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              <Shield className="w-4 h-4" />
              Admin
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              {user.image && (
                <img
                  src={user.image}
                  alt={user.name}
                  className="w-7 h-7 rounded-full"
                />
              )}
              <span className="text-sm text-text-muted hidden sm:inline">
                {user.name}
              </span>
              <button
                onClick={() => signOut()}
                className="text-text-muted hover:text-text transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn.social({ provider: "google" })}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
