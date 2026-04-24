import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogIn, LogOut, MapPin, ShieldAlert, Clock, Calendar, TrendingUp, FileText } from "lucide-react";
import { haversineDistance, generateDeviceFingerprint, isSameDevice, clearDeviceToken, getCurrentPosition } from "@/lib/geo";
import { useSmartNotifications } from "@/hooks/use-smart-notifications";
import { format } from "date-fns";
import BranchVisitLogger from "@/components/staff/BranchVisitLogger";
import ThemeToggle from "@/components/ThemeToggle";
import type { Tables } from "@/integrations/supabase/types";

type StaffProfile = Tables<"staff_profiles">;
type Branch = Tables<"branches">;

const StaffHome = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [geoError, setGeoError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [resolvedDeviceId, setResolvedDeviceId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<string>("00:00:00");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data as StaffProfile | null;
    },
    enabled: !!user,
  });

  const isAreaManager = profile?.employment_type === "Area-Manager";
  const isFreelancer = profile?.employment_type === "Freelancer";

  const { data: branch } = useQuery({
    queryKey: ["my-branch", profile?.branch_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").eq("id", profile!.branch_id!).single();
      if (error) throw error;
      return data as Branch;
    },
    enabled: !!profile?.branch_id && !isAreaManager && !isFreelancer,
  });

  // Freelancer: fetch all branches (like Area Manager, can select)
  const { data: allBranchesFreelancer = [] } = useQuery({
    queryKey: ["all-branches-freelancer"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data as Branch[];
    },
    enabled: isFreelancer,
  });

  // Area Manager: fetch all branches
  const { data: allBranches = [] } = useQuery({
    queryKey: ["all-branches-am"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data as Branch[];
    },
    enabled: isAreaManager,
  });

  const [selectedBranchId, setSelectedBranchId] = useState("");
  const activeBranch = isAreaManager
    ? allBranches.find((b) => b.id === selectedBranchId) ?? null
    : isFreelancer
    ? (profile?.branch_id ? allBranchesFreelancer.find((b) => b.id === profile.branch_id) : allBranchesFreelancer.find((b) => b.id === selectedBranchId)) ?? null
    : branch ?? null;

  const { data: activeLog } = useQuery({
    queryKey: ["active-attendance", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("attendance_logs").select("*").eq("user_id", user!.id)
        .gte("check_in_time", today).is("check_out_time", null).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: monthOt = 0 } = useQuery({
    queryKey: ["month-ot", user?.id],
    queryFn: async () => {
      const start = format(new Date(), "yyyy-MM-01");
      const { data, error } = await supabase.from("attendance_logs").select("ot_hours")
        .eq("user_id", user!.id).gte("check_in_time", start);
      if (error) throw error;
      return (data ?? []).reduce((s, r) => s + Number(r.ot_hours), 0);
    },
    enabled: !!user,
  });

  const { data: latestPayslip } = useQuery({
    queryKey: ["latest-payslip", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_runs").select("month, net_pay")
        .eq("staff_profile_id", profile!.id).eq("status", "released")
        .order("month", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  // Check for missed clock-out from previous days
  const { data: missedClockOut } = useQuery({
    queryKey: ["missed-clockout", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("attendance_logs").select("id, check_in_time")
        .eq("user_id", user!.id)
        .lt("check_in_time", today)
        .is("check_out_time", null)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Smart notifications
  useSmartNotifications(user?.id, activeBranch, activeLog?.check_in_time ?? null, !!activeLog);

  // Device binding
  useEffect(() => { setResolvedDeviceId(profile?.device_id ?? null); }, [profile?.device_id]);

  const bindDeviceMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error("Profile not found");
      const fingerprint = generateDeviceFingerprint();
      const { error } = await supabase.from("staff_profiles").update({ device_id: fingerprint }).eq("id", profile.id).eq("user_id", user.id);
      if (error) throw error;
      return fingerprint;
    },
    onSuccess: (fp) => { setResolvedDeviceId(fp); queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] }); },
  });

  useEffect(() => {
    if (!user || !profile || !profile.is_device_binding_required || profile.device_id || resolvedDeviceId || bindDeviceMutation.isPending) return;
    bindDeviceMutation.mutate();
  }, [user, profile, resolvedDeviceId, bindDeviceMutation.isPending]);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (activeBranch) setDistance(haversineDistance(pos.coords.latitude, pos.coords.longitude, activeBranch.latitude, activeBranch.longitude));
      }, () => {}, { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [activeBranch]);

  // Live timer
  useEffect(() => {
    if (!activeLog) { setElapsed("00:00:00"); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(activeLog.check_in_time).getTime()) / 1000);
      const h = String(Math.floor(diff / 3600)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeLog]);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      setGeoError(null); setDeviceError(null);
      const checkBranch = (isAreaManager || isFreelancer) ? activeBranch : branch;
      if (!profile || !checkBranch) throw new Error((isAreaManager || isFreelancer) ? "Select a branch first." : "No branch assigned.");

      // Device binding check — skip if not required
      if (profile.is_device_binding_required) {
        const fingerprint = generateDeviceFingerprint();
        const currentDeviceId = resolvedDeviceId ?? profile.device_id;
        if (currentDeviceId && !isSameDevice(currentDeviceId, fingerprint)) {
          clearDeviceToken();
          setDeviceError("This account is locked to another device. Contact Admin.");
          throw new Error("Device mismatch");
        }
        if (!currentDeviceId) {
          await supabase.from("staff_profiles").update({ device_id: fingerprint }).eq("id", profile.id).eq("user_id", user!.id);
          setResolvedDeviceId(fingerprint);
        }
      }

      const pos = await getCurrentPosition();
      const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, checkBranch.latitude, checkBranch.longitude);
      if (dist > checkBranch.radius_meters) {
        setGeoError(`You are ${Math.round(dist)}m away. Move closer to ${checkBranch.name}.`);
        throw new Error("Out of range");
      }

      // No late penalty for freelancers, but flag unusual hours
      let lateMinutes = 0;
      if (!isFreelancer) {
        const now = new Date();
        const [schedH, schedM] = (checkBranch as any).scheduled_start?.split(":").map(Number) ?? [9, 30];
        const scheduledTime = new Date(now); scheduledTime.setHours(schedH, schedM, 0, 0);
        const graceMs = ((checkBranch as any).grace_period_minutes ?? 10) * 60 * 1000;
        if (now > new Date(scheduledTime.getTime() + graceMs)) {
          lateMinutes = Math.round((now.getTime() - scheduledTime.getTime()) / 60000);
        }
      }

      const { error } = await supabase.from("attendance_logs").insert({
        user_id: user!.id, branch_id: checkBranch.id,
        check_in_lat: pos.coords.latitude, check_in_long: pos.coords.longitude,
        status: (lateMinutes > 0 ? "late" : "on_time") as any, late_minutes: lateMinutes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-attendance", user?.id] });
      toast({ title: "Checked In!", description: "Your attendance has been recorded." });
    },
    onError: (err: Error) => {
      if (err.message !== "Device mismatch" && err.message !== "Out of range")
        toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!activeLog) throw new Error("No active check-in found.");
      const checkIn = new Date(activeLog.check_in_time);
      const now = new Date();
      const totalHours = (now.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      const restHours = Math.floor(totalHours / 5);
      const netHours = Math.max(totalHours - restHours, 0);
      const regularHours = Math.min(netHours, 8);
      const otHours = Math.max(netHours - 8, 0);

      const { error } = await supabase.from("attendance_logs").update({
        check_out_time: now.toISOString(),
        rest_hours: Math.round(restHours * 100) / 100,
        net_hours: Math.round(netHours * 100) / 100,
        regular_hours: Math.round(regularHours * 100) / 100,
        ot_hours: Math.round(otHours * 100) / 100,
      }).eq("id", activeLog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-attendance", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["month-ot", user?.id] });
      toast({ title: "Checked Out!", description: "Have a great rest of the day." });
    },
    onError: (err: Error) => toast({ title: "Check-out failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !profile) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div>;
  }

  const inRange = distance !== null && activeBranch ? distance <= activeBranch.radius_meters : null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
          <h1 className="text-xl font-bold">Welcome, {profile.name.split(" ")[0]}</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground font-mono">{profile.staff_id}</p>
            {isAreaManager && <Badge variant="secondary" className="text-[10px]">Area Manager</Badge>}
            {isFreelancer && <Badge variant="secondary" className="text-[10px]">Freelancer</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Missed Clock-Out Warning */}
      {missedClockOut && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription className="text-sm">
            ⚠️ You missed a Clock Out on {format(new Date(missedClockOut.check_in_time), "dd MMM yyyy")}. Please contact Admin to rectify your hours.
          </AlertDescription>
        </Alert>
      )}

      {/* Area Manager / Freelancer Branch Selector */}
      {(isAreaManager || (isFreelancer && !profile?.branch_id)) && !activeLog && (
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Select Branch to Check In</p>
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose any branch..." />
              </SelectTrigger>
              <SelectContent>
                {(isAreaManager ? allBranches : allBranchesFreelancer).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Attendance Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-5 space-y-4">
          {/* Location Status */}
          <div className="flex items-center gap-2">
            <MapPin className={`h-4 w-4 ${inRange === true ? "text-green-500" : inRange === false ? "text-destructive" : "text-muted-foreground"}`} />
            <span className="text-sm font-medium">
              {inRange === true ? "Within Geofence" : inRange === false ? "Out of Range" : "Locating..."}
            </span>
            {distance !== null && (
              <span className="text-xs text-muted-foreground ml-auto">{Math.round(distance)}m away</span>
            )}
          </div>

          {/* Timer */}
          {activeLog && (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Working Time</p>
              <p className="text-4xl font-mono font-bold tracking-tight mt-1">{elapsed}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Since {new Date(activeLog.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}

          {/* Errors */}
          {geoError && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{geoError}</AlertDescription>
            </Alert>
          )}
          {deviceError && (
            <Alert variant="destructive" className="py-2">
              <ShieldAlert className="h-3 w-3" />
              <AlertDescription className="text-xs">{deviceError}</AlertDescription>
            </Alert>
          )}

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="btn-tech-green h-14 text-base rounded-xl shadow-md"
              disabled={!!activeLog || checkInMutation.isPending || ((isAreaManager || (isFreelancer && !profile?.branch_id)) && !selectedBranchId)}
              onClick={() => checkInMutation.mutate()}
            >
              <LogIn className="h-5 w-5 mr-2" />
              {checkInMutation.isPending ? "..." : "Clock In"}
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="h-14 text-base rounded-xl shadow-md"
              disabled={!activeLog || checkOutMutation.isPending}
              onClick={() => checkOutMutation.mutate()}
            >
              <LogOut className="h-5 w-5 mr-2" />
              {checkOutMutation.isPending ? "..." : "Clock Out"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Branch Visit Logger for Area Managers */}
      {isAreaManager && profile && (
        <BranchVisitLogger profileId={profile.id} />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{profile.al_balance}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Leave Left</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{monthOt.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">OT Hours</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <FileText className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">
              {latestPayslip ? `RM${Number(latestPayslip.net_pay).toFixed(0)}` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">Last Pay</p>
          </CardContent>
        </Card>
      </div>

      {/* Privacy Disclaimer */}
      <p className="text-[10px] text-muted-foreground text-center px-4 pb-4">
        📍 Location is tracked for travel claims and safety during working hours only. GPS tracking occurs only when you tap Clock In or Log Visit.
      </p>
    </div>
  );
};

export default StaffHome;
