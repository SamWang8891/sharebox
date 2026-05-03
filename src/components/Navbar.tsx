import { Link } from "react-router-dom";
import { Shield, LogOut, Box } from "lucide-react";
import { SignInButton, SignedIn, SignedOut, useClerk } from "@clerk/clerk-react";
import { ThemeToggle } from "./ThemeToggle";
import type { CurrentUser } from "../lib/api";

export function Navbar({ user }: { user: CurrentUser | null }) {
  const { signOut } = useClerk();

  return (
    <nav
      className="border-b border-border bg-surface-light/70 backdrop-blur-md sticky top-0 z-50"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-base sm:text-lg hover:text-primary transition-colors shrink-0"
        >
          <Box className="w-5 h-5 text-primary" />
          <span>ShareBox</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {user?.isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors px-1"
              title="Admin"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          <ThemeToggle />

          <SignedIn>
            <div className="flex items-center gap-2 sm:gap-3">
              {user?.image && (
                <img
                  src={user.image}
                  alt={user.name}
                  className="w-7 h-7 rounded-full"
                />
              )}
              {user?.name && (
                <span className="text-sm text-text-muted hidden md:inline max-w-[12ch] truncate">
                  {user.name}
                </span>
              )}
              <button
                onClick={() => signOut({ redirectUrl: "/" })}
                className="text-text-muted hover:text-text transition-colors p-1"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </nav>
  );
}
