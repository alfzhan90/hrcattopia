import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import StaffLayout from "@/components/StaffLayout";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "./pages/NotFound.tsx";

// Admin pages — lazy loaded so staff never download this code
const CompanySettings = lazy(() => import("@/pages/admin/CompanySettings"));
const Branches = lazy(() => import("@/pages/admin/Branches"));
const Staff = lazy(() => import("@/pages/admin/Staff"));
const AttendanceRecords = lazy(() => import("@/pages/admin/AttendanceRecords"));
const LiveAttendance = lazy(() => import("@/pages/admin/LiveAttendance"));
const Payroll = lazy(() => import("@/pages/admin/Payroll"));
const Management = lazy(() => import("@/pages/admin/Management"));
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"));
const Freelancers = lazy(() => import("@/pages/admin/Freelancers"));
const Schedules = lazy(() => import("@/pages/admin/Schedules"));
const Approvals = lazy(() => import("@/pages/admin/Approvals"));
const HR = lazy(() => import("@/pages/admin/HR"));

// Staff pages — lazy loaded
const StaffHome = lazy(() => import("@/pages/staff/StaffHome"));
const StaffLogs = lazy(() => import("@/pages/staff/StaffLogs"));
const StaffLeave = lazy(() => import("@/pages/staff/StaffLeave"));
const StaffPayslips = lazy(() => import("@/pages/staff/StaffPayslips"));
const StaffInvoices = lazy(() => import("@/pages/staff/StaffInvoices"));
const StaffProfile = lazy(() => import("@/pages/staff/StaffProfile"));

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
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
  if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (role === "area_manager") return <Navigate to="/admin/schedules" replace />;
  return <Navigate to="/staff/dashboard" replace />;
};

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<HomeRedirect />} />
      {/* Staff mobile routes */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<StaffHome />} />
        <Route path="logs" element={<StaffLogs />} />
        <Route path="leave" element={<StaffLeave />} />
        <Route path="payslips" element={<StaffPayslips />} />
        <Route path="invoices" element={<StaffInvoices />} />
        <Route path="profile" element={<StaffProfile />} />
      </Route>
      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="company" element={<CompanySettings />} />
        <Route path="branches" element={<Branches />} />
        <Route path="staff" element={<Staff />} />
        <Route path="records" element={<AttendanceRecords />} />
        <Route path="attendance" element={<LiveAttendance />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="freelancers" element={<Freelancers />} />
        <Route path="schedules" element={<Schedules />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="hr" element={<HR />} />
        <Route path="management" element={<Management />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
