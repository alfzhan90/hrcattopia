import { NavLink } from "react-router-dom";
import { Home, Calendar, FileText, User, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const StaffBottomNav = () => {
  const { user } = useAuth();

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

  const tabs = [
    { to: "/staff/dashboard", icon: Home, label: "Home" },
    { to: "/staff/logs", icon: ClipboardList, label: "My Logs" },
    ...(!isFreelancer ? [{ to: "/staff/leave", icon: Calendar, label: "Leave" }] : []),
    isFreelancer
      ? { to: "/staff/invoices", icon: FileText, label: "My Invoices" }
      : { to: "/staff/payslips", icon: FileText, label: "Payslips" },
    { to: "/staff/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur safe-area-pb"
      style={{ background: "hsl(0 0% 7% / 0.97)", borderColor: "hsl(0 0% 16%)" }}>
      <div className="flex h-16 items-center justify-around max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-medium transition-all duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-primary" />
                )}
                <div className={cn(
                  "p-1 rounded-lg transition-all duration-200",
                  isActive ? "bg-primary/15" : ""
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default StaffBottomNav;
