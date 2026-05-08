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
import ThemeToggle from "@/components/ThemeToggle";

const adminNavItems = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
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

const adminDockItems = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Home" },
  { to: "/admin/attendance", icon: ClipboardList, label: "Attendance" },
  { to: "/admin/payroll", icon: DollarSign, label: "Payroll" },
  { to: "/admin/management", icon: LayoutDashboard, label: "Management" },
];

const areaManagerDockItems = [
  { to: "/admin/schedules", icon: CalendarDays, label: "Shifts" },
  { to: "/admin/approvals", icon: CheckSquare, label: "Approvals" },
  { to: "/admin/management", icon: LayoutDashboard, label: "Management" },
];

const AdminLayout = () => {
  const { user, role, signOut } = useAuth();
  const { data: companySettings } = useCompanySettings();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = role === "area_manager" ? managerNavItems : adminNavItems;
  const dockItems = role === "area_manager" ? areaManagerDockItems : adminDockItems;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
      isActive
        ? "bg-white/[0.09] text-white font-medium ring-1 ring-white/[0.08] ring-inset"
        : "font-normal text-sidebar-foreground/55 hover:bg-white/[0.05] hover:text-sidebar-foreground/90"
    }`;

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        {/* Mobile header */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-carbon px-4 h-12">
          <div className="flex items-center gap-2 min-w-0">
            {companySettings?.logo_url ? (
              <img src={companySettings.logo_url} alt="Logo" className="h-6 w-6 object-contain rounded" />
            ) : (
              <div className="gold-avatar h-6 w-6 text-[10px]">
                {(companySettings?.company_name || "HR")[0]}
              </div>
            )}
            <span className="text-[13px] font-semibold text-sidebar-foreground truncate">
              {companySettings?.company_name || "HR & Payroll"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle className="text-sidebar-foreground/70 hover:text-sidebar-foreground" />
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
          <div className="fixed inset-x-0 top-12 z-30 bg-sidebar border-b border-sidebar-border px-3 py-3 space-y-0.5 animate-in slide-in-from-top-2">
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
      <aside className="w-[220px] shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-sidebar-border/60">
          <div className="flex items-center gap-2.5">
            {companySettings?.logo_url ? (
              <img src={companySettings.logo_url} alt="Logo" className="h-7 w-7 object-contain rounded" />
            ) : (
              <div className="gold-avatar h-7 w-7 text-xs shrink-0">
                {(companySettings?.company_name || "HR")[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-sidebar-foreground leading-tight truncate">
                {companySettings?.company_name || "HR & Payroll"}
              </p>
              <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-[0.08em] mt-0.5">HR Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon className="h-[15px] w-[15px] shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-sidebar-border/60 space-y-0.5">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary">
                {user?.email?.[0]?.toUpperCase() ?? 'A'}
              </span>
            </div>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email?.split('@')[0]}</p>
            <ThemeToggle className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0 h-6 w-6" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-white/[0.05] h-8 text-xs px-3"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-end gap-2.5 border-b bg-background/98 backdrop-blur-sm px-6">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-[13px] font-medium leading-none text-foreground">{user?.email?.split('@')[0]}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{user?.email}</p>
            </div>
            <div className="h-7 w-7 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <span className="text-[11px] font-semibold text-primary">
                {user?.email?.[0]?.toUpperCase() ?? 'A'}
              </span>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
