import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Building2, Users, LogOut, ClipboardList, DollarSign, Settings,
  FileSpreadsheet, LayoutDashboard, UserCheck, Plus, UserPlus, Clock, Menu, X,
  CalendarDays, CheckSquare,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const adminNavItems = [
  { to: "/admin/company", icon: Settings, label: "Company Settings" },
  { to: "/admin/branches", icon: Building2, label: "Branches" },
  { to: "/admin/staff", icon: Users, label: "Staff" },
  { to: "/admin/records", icon: FileSpreadsheet, label: "Attendance Records" },
  { to: "/admin/attendance", icon: ClipboardList, label: "Live Attendance" },
  { to: "/admin/schedules", icon: CalendarDays, label: "Shift Planner" },
  { to: "/admin/approvals", icon: CheckSquare, label: "Approvals" },
  { to: "/admin/payroll", icon: DollarSign, label: "Payroll" },
  { to: "/admin/freelancers", icon: UserCheck, label: "Freelancers" },
  { to: "/admin/management", icon: LayoutDashboard, label: "Management" },
];

const managerNavItems = [
  { to: "/admin/schedules", icon: CalendarDays, label: "Shift Planner" },
  { to: "/admin/approvals", icon: CheckSquare, label: "Approvals" },
  { to: "/admin/management", icon: LayoutDashboard, label: "Management" },
];

const dockItems = [
  { to: "/admin/branches", icon: Building2, label: "Home" },
  { to: "/admin/attendance", icon: ClipboardList, label: "Attendance" },
  { to: "/admin/payroll", icon: DollarSign, label: "Payroll" },
  { to: "/admin/management", icon: LayoutDashboard, label: "Management" },
];

const AdminLayout = () => {
  const { user, role, signOut } = useAuth();
  const { data: companySettings } = useCompanySettings();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = role === "area_manager" ? managerNavItems : adminNavItems;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
      isActive
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
    }`;

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        {/* Mobile header */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-carbon px-4 h-14">
          <div className="flex items-center gap-2 min-w-0">
            {companySettings?.logo_url ? (
              <img src={companySettings.logo_url} alt="Logo" className="h-7 w-7 object-contain rounded" />
            ) : (
              <div className="gold-avatar h-7 w-7 text-xs">
                {(companySettings?.company_name || "HR")[0]}
              </div>
            )}
            <span className="text-sm font-bold text-sidebar-foreground truncate">
              {companySettings?.company_name || "HR & Payroll"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground/70"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {/* Mobile slide-down menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-x-0 top-14 z-30 bg-carbon border-b border-carbon-light p-4 space-y-1 animate-in slide-in-from-top-2">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={linkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/70 mt-2" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        )}

        {/* Main content */}
        <main className="overflow-auto">
          <Outlet />
        </main>

        {/* Bottom Dock */}
        <nav className="admin-bottom-dock safe-area-pb">
          <div className="flex h-16 items-center justify-around max-w-lg mx-auto">
            {dockItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors ${
                    isActive ? "text-gold" : "text-sidebar-foreground/50"
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Gold FAB */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="gold-fab">
              <Plus className="h-6 w-6" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate("/admin/staff")}>
              <UserPlus className="h-4 w-4 mr-2" /> Add Staff
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/admin/attendance")}>
              <Clock className="h-4 w-4 mr-2" /> Manual Clock-In
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            {companySettings?.logo_url ? (
              <img src={companySettings.logo_url} alt="Logo" className="h-8 w-8 object-contain rounded" />
            ) : (
              <div className="gold-avatar h-8 w-8 text-sm">
                {(companySettings?.company_name || "HR")[0]}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-sidebar-foreground truncate">
                {companySettings?.company_name || "HR & Payroll"}
              </h1>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
