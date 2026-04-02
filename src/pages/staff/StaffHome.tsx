import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LogIn, LogOut, MapPin, ShieldAlert, Clock, Calendar, TrendingUp, FileText } from "lucide-react";
import { haversineDistance, generateDeviceFingerprint, getCurrentPosition } from "@/lib/geo";
import { format } from "date-fns";
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

  const { data: branch } = useQuery({
    queryKey: ["my-branch", profile?.branch_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").eq("id", profile!.branch_id!).single();
      if (error) throw error;
      return data as Branch;
    },
    enabled: !!profile?.branch_id,
  });

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
    if (!user || !profile || profile.device_id || resolvedDeviceId || bindDeviceMutation.isPending) return;
    bindDeviceMutation.mutate();
  }, [user, profile, resolvedDeviceId, bindDeviceMutation.isPending]);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (branch) setDistance(haversineDistance(pos.coords.latitude, pos.coords.longitude, branch.latitude, branch.longitude));
      }, () => {}, { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [branch]);

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
      if (!profile || !branch) throw new Error("No branch assigned.");

      const fingerprint = generateDeviceFingerprint();
      const currentDeviceId = resolvedDeviceId ?? profile.device_id;
      if (currentDeviceId && currentDeviceId !== fingerprint) {
        setDeviceError("This account is locked to another device. Contact Admin.");
        throw new Error("Device mismatch");
      }
      if (!currentDeviceId) {
        await supabase.from("staff_profiles").update({ device_id: fingerprint }).eq("id", profile.id).eq("user_id", user!.id);
        setResolvedDeviceId(fingerprint);
      }

      const pos = await getCurrentPosition();
      const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, branch.latitude, branch.longitude);
      if (dist > branch.radius_meters) {
        setGeoError(`You are ${Math.round(dist)}m away. Move closer to ${branch.name}.`);
        throw new Error("Out of range");
      }

      let lateMinutes = 0;
      const now = new Date();
      const [schedH, schedM] = (branch as any).scheduled_start?.split(":").map(Number) ?? [9, 30];
      const scheduledTime = new Date(now); scheduledTime.setHours(schedH, schedM, 0, 0);
      const graceMs = ((branch as any).grace_period_minutes ?? 10) * 60 * 1000;
      if (now > new Date(scheduledTime.getTime() + graceMs)) {
        lateMinutes = Math.round((now.getTime() - scheduledTime.getTime()) / 60000);
      }

      const { error } = await supabase.from("attendance_logs").insert({
        user_id: user!.id, branch_id: branch.id,
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

  const inRange = distance !== null && branch ? distance <= branch.radius_meters : null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
          <h1 className="text-xl font-bold">Welcome, {profile.name.split(" ")[0]}</h1>
          <p className="text-xs text-muted-foreground font-mono">{profile.staff_id}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

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
              className="h-14 text-base bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md"
              disabled={!!activeLog || checkInMutation.isPending}
              onClick={() => checkInMutation.mutate()}
            >
              <LogIn className="h-5 w-5 mr-2" />
              {checkInMutation.isPending ? "..." : "Clock In"}
            </Button>
            <Button
              size="lg"
              className="h-14 text-base bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md"
              disabled={!activeLog || checkOutMutation.isPending}
              onClick={() => checkOutMutation.mutate()}
            >
              <LogOut className="h-5 w-5 mr-2" />
              {checkOutMutation.isPending ? "..." : "Clock Out"}
            </Button>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
};

export default StaffHome;
