import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { Button } from "@/components/ui/button";
import { Building2, Users, LogOut, ClipboardList, DollarSign, Settings, FileSpreadsheet, LayoutDashboard, UserCheck } from "lucide-react";

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
          <div className="flex items-center gap-3">
            {companySettings?.logo_url && (
              <img src={companySettings.logo_url} alt="Logo" className="h-8 w-8 object-contain rounded" />
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-sidebar-foreground truncate">
                {companySettings?.company_name || "HR & Payroll"}
              </h1>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/admin/company" className={linkClass}>
            <Settings className="h-4 w-4" />
            Company Settings
          </NavLink>
          <NavLink to="/admin/branches" className={linkClass}>
            <Building2 className="h-4 w-4" />
            Branches
          </NavLink>
          <NavLink to="/admin/staff" className={linkClass}>
            <Users className="h-4 w-4" />
            Staff
          </NavLink>
          <NavLink to="/admin/records" className={linkClass}>
            <FileSpreadsheet className="h-4 w-4" />
            Attendance Records
          </NavLink>
          <NavLink to="/admin/attendance" className={linkClass}>
            <ClipboardList className="h-4 w-4" />
            Live Attendance
          </NavLink>
          <NavLink to="/admin/payroll" className={linkClass}>
            <DollarSign className="h-4 w-4" />
            Payroll
          </NavLink>
          <NavLink to="/admin/freelancers" className={linkClass}>
            <UserCheck className="h-4 w-4" />
            Freelancers
          </NavLink>
          <NavLink to="/admin/management" className={linkClass}>
            <LayoutDashboard className="h-4 w-4" />
            Management
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
