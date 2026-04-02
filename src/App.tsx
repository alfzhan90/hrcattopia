import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import Login from "@/pages/Login";
import Branches from "@/pages/admin/Branches";
import Staff from "@/pages/admin/Staff";
import LiveAttendance from "@/pages/admin/LiveAttendance";
import Payroll from "@/pages/admin/Payroll";
import Attendance from "@/pages/Attendance";
import StaffDashboard from "@/pages/StaffDashboard";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const HomeRedirect = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!role) return <Navigate to="/login" replace />;
  if (role === "admin") return <Navigate to="/admin/branches" replace />;
  return <Navigate to="/staff/dashboard" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/" element={<HomeRedirect />} />
    <Route
      path="/attendance"
      element={
        <ProtectedRoute>
          <Attendance />
        </ProtectedRoute>
      }
    />
    <Route
      path="/staff/dashboard"
      element={
        <ProtectedRoute>
          <StaffDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin"
      element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout />
        </ProtectedRoute>
      }
    >
      <Route path="branches" element={<Branches />} />
      <Route path="staff" element={<Staff />} />
      <Route path="attendance" element={<LiveAttendance />} />
      <Route path="payroll" element={<Payroll />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
