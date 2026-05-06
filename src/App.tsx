import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import { FileView } from "./pages/FileView";
import { Admin } from "./pages/Admin";
import { EditView } from "./pages/EditView";
import { UploadDropbox } from "./pages/UploadDropbox";
import { getMe, type CurrentUser } from "./lib/api";
import { Loader2 } from "lucide-react";

export default function App() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const [serverUser, setServerUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoaded) return;
    let cancelled = false;
    if (!isSignedIn) {
      setServerUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getMe()
      .then((u) => !cancelled && setServerUser(u))
      .catch(() => !cancelled && setServerUser(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [authLoaded, isSignedIn, clerkUser?.id]);

  if (!authLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <Layout user={serverUser}>
      <Routes>
        <Route
          path="/"
          element={
            serverUser?.isApproved ? (
              <Dashboard />
            ) : (
              <Home user={serverUser} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            serverUser?.isApproved ? <Dashboard /> : <Navigate to="/" replace />
          }
        />
        <Route path="/f/:id" element={<FileView />} />
        <Route path="/u/:id" element={<UploadDropbox />} />
        <Route
          path="/edit/:id"
          element={
            serverUser?.isApproved ? (
              <EditView />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/admin"
          element={
            serverUser?.isAdmin ? <Admin /> : <Navigate to="/" replace />
          }
        />
      </Routes>
    </Layout>
  );
}
