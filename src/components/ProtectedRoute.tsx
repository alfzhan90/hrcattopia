import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Enums } from "@/integrations/supabase/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Enums<"app_role">;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !role) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    // Staff trying to access admin → redirect to staff dashboard
    if (role === "staff" && requiredRole === "admin") {
      return <Navigate to="/staff/dashboard" replace />;
    }
    // Admin trying to access staff-only → redirect to admin
    if (role === "admin") {
      return <Navigate to="/admin/branches" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
