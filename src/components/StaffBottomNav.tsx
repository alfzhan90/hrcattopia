import { NavLink } from "react-router-dom";
import { Home, Calendar, FileText, User, ClipboardList, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const StaffBottomNav = () => {
  const { user, role } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["my-profile-nav", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("employment_type").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: Infinity,
  });

  const isFreelancer = profile?.employment_type === "Freelancer";
  const isAreaManager = role === "area_manager";

  const tabs = isAreaManager
    ? [
        { to: "/staff/dashboard", icon: Home, label: "Home", mobileLabel: "Home" },
        { to: "/admin/schedules", icon: CalendarDays, label: "Shift Planner", mobileLabel: "Shift\nPlanner" },
        { to: "/staff/logs", icon: ClipboardList, label: "My Logs", mobileLabel: "My\nLogs" },
        { to: "/staff/leave", icon: Calendar, label: "Leave", mobileLabel: "Leave" },
        { to: "/staff/payslips", icon: FileText, label: "Payslips", mobileLabel: "Pay\nslips" },
        { to: "/staff/profile", icon: User, label: "Profile", mobileLabel: "Profile" },
      ]
    : [
        { to: "/staff/dashboard", icon: Home, label: "Home", mobileLabel: "Home" },
        { to: "/staff/logs", icon: ClipboardList, label: "My Logs", mobileLabel: "My Logs" },
        ...(!isFreelancer ? [{ to: "/staff/leave", icon: Calendar, label: "Leave", mobileLabel: "Leave" }] : []),
        isFreelancer
          ? { to: "/staff/invoices", icon: FileText, label: "My Invoices", mobileLabel: "My Invoices" }
          : { to: "/staff/payslips", icon: FileText, label: "Payslips", mobileLabel: "Payslips" },
        { to: "/staff/profile", icon: User, label: "Profile", mobileLabel: "Profile" },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur safe-area-pb"
      style={{ background: "hsl(0 0% 7% / 0.97)", borderColor: "hsl(0 0% 18%)" }}>
      <div className={cn("mx-auto grid h-16 max-w-lg items-center", isAreaManager ? "grid-cols-6" : "grid-cols-5")}>
        {tabs.map(({ to, icon: Icon, label, mobileLabel }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            title={label}
            className={({ isActive }) =>
              cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1 font-medium leading-none transition-colors",
                isAreaManager ? "text-[10px]" : "text-xs",
                isActive ? "text-gold" : "text-muted-foreground"
              )
            }
          >
            <Icon className={cn(isAreaManager ? "h-4 w-4" : "h-5 w-5")} />
            <span className={cn("text-center whitespace-pre-line", isAreaManager && "max-w-[3.75rem]")}>{mobileLabel}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default StaffBottomNav;
