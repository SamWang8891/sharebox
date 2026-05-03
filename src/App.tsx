import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { StackHandler, useUser } from "@stackframe/react";
import { stackApp } from "./lib/stack";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import { FileView } from "./pages/FileView";
import { Admin } from "./pages/Admin";
import { getMe, type CurrentUser } from "./lib/api";
import { Loader2 } from "lucide-react";

function HandlerRoute() {
  const location = useLocation();
  return (
    <StackHandler app={stackApp} location={location.pathname} fullPage />
  );
}

export default function App() {
  const stackUser = useUser();
  const [serverUser, setServerUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!stackUser) {
      setServerUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getMe()
      .then((u) => {
        if (!cancelled) setServerUser(u);
      })
      .catch(() => {
        if (!cancelled) setServerUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stackUser?.id]);

  return (
    <Routes>
      {/* Stack Auth handler — sign-in, sign-up, oauth callback, etc. */}
      <Route path="/handler/*" element={<HandlerRoute />} />

      <Route
        path="*"
        element={
          <Layout user={serverUser}>
            {loading ? (
              <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
              </div>
            ) : (
              <Routes>
                <Route path="/" element={<Home user={serverUser} />} />
                <Route
                  path="/dashboard"
                  element={
                    serverUser?.isApproved ? (
                      <Dashboard />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  }
                />
                <Route path="/f/:id" element={<FileView />} />
                <Route
                  path="/admin"
                  element={
                    serverUser?.isAdmin ? (
                      <Admin />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  }
                />
              </Routes>
            )}
          </Layout>
        }
      />
    </Routes>
  );
}
