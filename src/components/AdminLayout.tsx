import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { Button } from "@/components/ui/button";
import { Building2, Users, LogOut, ClipboardList, DollarSign, Settings, FileSpreadsheet } from "lucide-react";

const AdminLayout = () => {
  const { user, signOut } = useAuth();
  const { data: companySettings } = useCompanySettings();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    }`;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar-background flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-lg font-semibold text-sidebar-foreground">HR & Payroll</h1>
          <p className="text-xs text-muted-foreground mt-1 truncate">{user?.email}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/admin/branches" className={linkClass}>
            <Building2 className="h-4 w-4" />
            Branches
          </NavLink>
          <NavLink to="/admin/staff" className={linkClass}>
            <Users className="h-4 w-4" />
            Staff
          </NavLink>
          <NavLink to="/admin/attendance" className={linkClass}>
            <ClipboardList className="h-4 w-4" />
            Live Attendance
          </NavLink>
          <NavLink to="/admin/payroll" className={linkClass}>
            <DollarSign className="h-4 w-4" />
            Payroll
          </NavLink>
        </nav>
        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
