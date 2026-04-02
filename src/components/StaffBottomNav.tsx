import { NavLink } from "react-router-dom";
import { Home, Calendar, FileText, User, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/staff/dashboard", icon: Home, label: "Home" },
  { to: "/staff/logs", icon: ClipboardList, label: "My Logs" },
  { to: "/staff/leave", icon: Calendar, label: "Leave" },
  { to: "/staff/payslips", icon: FileText, label: "Payslips" },
  { to: "/staff/profile", icon: User, label: "Profile" },
];

const StaffBottomNav = () => (
  <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-pb">
    <div className="flex h-16 items-center justify-around max-w-lg mx-auto">
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )
          }
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  </nav>
);

export default StaffBottomNav;
