import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import { FileView } from "./pages/FileView";
import { Admin } from "./pages/Admin";
import { getMe, type CurrentUser } from "./lib/api";
import { Loader2 } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <Layout user={user}>
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route
          path="/dashboard"
          element={
            user?.isApproved ? <Dashboard /> : <Navigate to="/" replace />
          }
        />
        <Route path="/f/:id" element={<FileView />} />
        <Route
          path="/admin"
          element={
            user?.isAdmin ? <Admin /> : <Navigate to="/" replace />
          }
        />
      </Routes>
    </Layout>
  );
}
