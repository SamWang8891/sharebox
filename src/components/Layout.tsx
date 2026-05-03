import { Navbar } from "./Navbar";
import type { CurrentUser } from "../lib/api";

export function Layout({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user} />
      <main className="flex-1">{children}</main>
      <footer
        className="border-t border-border py-4 text-center text-xs text-text-muted"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        ShareBox — Self-hosted file sharing
      </footer>
    </div>
  );
}
