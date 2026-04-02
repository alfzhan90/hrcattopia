import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, Smartphone, Building2, User, CreditCard } from "lucide-react";
import { generateDeviceFingerprint } from "@/lib/geo";

const StaffProfile = () => {
  const { user, signOut } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: branch } = useQuery({
    queryKey: ["my-branch", profile?.branch_id],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("id", profile!.branch_id!).single();
      return data;
    },
    enabled: !!profile?.branch_id,
  });

  if (!profile) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div>;
  }

  const currentFingerprint = generateDeviceFingerprint();
  const deviceVerified = profile.device_id === currentFingerprint;

  const fields = [
    { icon: User, label: "Staff ID", value: profile.staff_id },
    { icon: User, label: "Full Name", value: profile.name },
    { icon: CreditCard, label: "IC Number", value: profile.ic_number },
    { icon: CreditCard, label: "KWSP No.", value: profile.kwsp_number || "—" },
    { icon: CreditCard, label: "SOCSO No.", value: profile.socso_number || "—" },
    { icon: Building2, label: "Branch", value: branch?.name || "—" },
    { icon: User, label: "Employment", value: profile.employment_type },
    { icon: CreditCard, label: "Base Rate", value: `RM ${Number(profile.base_rate).toFixed(2)}` },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
      <h1 className="text-xl font-bold">Profile</h1>

      {/* Info Card */}
      <Card className="rounded-xl">
        <CardContent className="p-0 divide-y">
          {fields.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium truncate">{value}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Device Status */}
      <Card className="rounded-xl">
        <CardContent className="p-4 flex items-center gap-3">
          <Smartphone className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Device Status</p>
            <p className="text-xs text-muted-foreground font-mono truncate">{profile.device_id || "Not bound"}</p>
          </div>
          <Badge variant={deviceVerified ? "default" : "destructive"}>
            {deviceVerified ? "Verified" : profile.device_id ? "Different Device" : "Not Set"}
          </Badge>
        </CardContent>
      </Card>

      {/* Leave Balance */}
      <Card className="rounded-xl">
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Leave Balance</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{profile.al_balance}</p>
              <p className="text-xs text-muted-foreground">Annual Leave</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{profile.mc_balance}</p>
              <p className="text-xs text-muted-foreground">Medical Leave</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full h-12 rounded-xl" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-2" /> Sign Out
      </Button>
    </div>
  );
};

export default StaffProfile;
