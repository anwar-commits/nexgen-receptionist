import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { useAuth } from "./lib/auth";
import { useRealtime } from "./lib/realtime";
import { Bookings } from "./pages/Bookings";
import { CallDetail } from "./pages/CallDetail";
import { Callbacks } from "./pages/Callbacks";
import { Calls } from "./pages/Calls";
import { Dashboard } from "./pages/Dashboard";
import { Knowledge } from "./pages/Knowledge";
import { LeadDetail } from "./pages/LeadDetail";
import { Leads } from "./pages/Leads";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";

export default function App() {
  const { user, loading } = useAuth();
  useRealtime(Boolean(user));

  if (loading) return <Spinner label="Starting" />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="calls" element={<Calls />} />
        <Route path="calls/:id" element={<CallDetail />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="callbacks" element={<Callbacks />} />
        <Route path="knowledge" element={<Knowledge />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
