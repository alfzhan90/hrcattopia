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
import { LogIn, LogOut, MapPin, ShieldAlert, Clock, Calendar, TrendingUp, FileText, CalendarDays } from "lucide-react";
import { haversineDistance, generateDeviceFingerprint, isSameDevice, clearDeviceToken, getCurrentPosition } from "@/lib/geo";
import { useSmartNotifications } from "@/hooks/use-smart-notifications";
import { format } from "date-fns";
import BranchVisitLogger from "@/components/staff/BranchVisitLogger";
import ThemeToggle from "@/components/ThemeToggle";
import { REMARK, appendRemark } from "@/lib/attendance-remarks";
import type { Tables } from "@/integrations/supabase/types";

type StaffProfile = Tables<"staff_profiles">;
type Branch = Tables<"branches">;

// Isolated timer — only this re-renders every second, not the whole page
const ClockTimer = ({ checkInTime }: { checkInTime: string }) => {
  const [elapsed, setElapsed] = useState("00:00:00");
  useEffect(() => {
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(checkInTime).getTime()) / 1000);
      const h = String(Math.floor(diff / 3600)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [checkInTime]);
  return (
    <div className="text-center py-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">Working Time</p>
      <p className="text-4xl font-mono font-bold tracking-tight tabular-nums mt-1">{elapsed}</p>
      <p className="text-xs text-muted-foreground mt-1">
        Since {new Date(checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
};

const StaffHome = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [geoError, setGeoError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [resolvedDeviceId, setResolvedDeviceId] = useState<string | null>(null);

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
  const [autoDetected, setAutoDetected] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);
  const AUTO_SUGGEST_RADIUS = 200;
  const activeBranch = isAreaManager
    ? allBranches.find((b) => b.id === selectedBranchId) ?? null
    : isFreelancer
    ? allBranchesFreelancer.find((b) => b.id === selectedBranchId) ?? null
    : branch ?? null;

  // Find the most recent OPEN attendance log (no check_out_time) for this user.
  // We deliberately do NOT filter by today's date — using `new Date().toISOString()`
  // returns a UTC date which causes off-by-one bugs for staff in MYT (UTC+8) who
  // check in before 08:00 MYT but reload the page after the UTC date rolls over.
  // Looking up by `is null` + ordering returns the open log regardless of timezone.
  const { data: activeLog } = useQuery({
    queryKey: ["active-attendance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs").select("*").eq("user_id", user!.id)
        .is("check_out_time", null)
        .order("check_in_time", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
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
    staleTime: 1000 * 60 * 15, // refresh every 15 min — not critical
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
    staleTime: 1000 * 60 * 30, // payslip rarely changes — cache 30 min
  });

  const { data: upcomingShifts = [] } = useQuery({
    queryKey: ["my-shifts", profile?.id],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const in7 = format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("schedules")
        .select("id, date, start_time, end_time, branch_id, notes")
        .eq("staff_profile_id", profile!.id)
        .gte("date", today)
        .lte("date", in7)
        .order("date")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile,
    staleTime: 1000 * 60 * 10, // shifts change rarely during the day
  });

  // Check for missed clock-out from previous days.
  // We use MYT (Asia/Kuala_Lumpur) as the day boundary so that an evening reload
  // around midnight UTC does not mis-flag today's open log as "missed".
  const { data: missedClockOut } = useQuery({
    queryKey: ["missed-clockout", user?.id],
    queryFn: async () => {
      // Compute today's MYT date (UTC+8) — robust against UTC date rollover.
      const myt = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const todayMyt = `${myt.getUTCFullYear()}-${String(myt.getUTCMonth() + 1).padStart(2, "0")}-${String(myt.getUTCDate()).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("attendance_logs").select("id, check_in_time")
        .eq("user_id", user!.id)
        .lt("check_in_time", todayMyt)
        .is("check_out_time", null)
        .order("check_in_time", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!user,
    // Never let this background query throw and block the UI.
    retry: 1,
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

  // GPS poll every 15s using network/WiFi accuracy (fast, battery-friendly).
  // High-accuracy GPS is only used at the moment of actual clock-in.
  useEffect(() => {
    if (!navigator.geolocation) { setGpsDenied(true); return; }
    const fetchPos = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsDenied(false);
          setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (activeBranch) setDistance(haversineDistance(pos.coords.latitude, pos.coords.longitude, activeBranch.latitude, activeBranch.longitude));
        },
        (err) => { if (err?.code === err?.PERMISSION_DENIED) setGpsDenied(true); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 10000 }
      );
    };
    fetchPos();
    const id = setInterval(fetchPos, 15000);
    return () => clearInterval(id);
  }, [activeBranch]);

  // Auto-suggest closest branch within 200m for Area Managers / Freelancers
  useEffect(() => {
    if (!userPos) return;
    if (!(isAreaManager || isFreelancer)) return;
    if (selectedBranchId && autoDetected === false) return; // user picked manually
    const list = isAreaManager ? allBranches : allBranchesFreelancer;
    if (!list.length) return;
    let closest: { id: string; dist: number } | null = null;
    for (const b of list) {
      const d = haversineDistance(userPos.lat, userPos.lng, b.latitude, b.longitude);
      if (!closest || d < closest.dist) closest = { id: b.id, dist: d };
    }
    if (closest && closest.dist <= AUTO_SUGGEST_RADIUS && closest.id !== selectedBranchId) {
      setSelectedBranchId(closest.id);
      setAutoDetected(true);
    }
  }, [userPos, isAreaManager, isFreelancer, allBranches, allBranchesFreelancer]);


  const checkInMutation = useMutation({
    mutationFn: async () => {
      setGeoError(null); setDeviceError(null);
      if (!user) throw new Error("Not signed in. Please log in again.");
      if (!profile) throw new Error("Your profile is still loading. Please wait a moment and retry.");

      const checkBranch = (isAreaManager || isFreelancer) ? activeBranch : branch;
      if (!checkBranch) throw new Error((isAreaManager || isFreelancer) ? "Select a branch first." : "No branch assigned. Contact Admin.");

      // ---- Block clock-in if on approved leave today (MYT) ----
      {
        const myt = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const todayMyt = `${myt.getUTCFullYear()}-${String(myt.getUTCMonth() + 1).padStart(2, "0")}-${String(myt.getUTCDate()).padStart(2, "0")}`;
        const { data: leaveToday } = await supabase
          .from("leave_records")
          .select("id")
          .eq("staff_profile_id", profile.id)
          .eq("status", "approved" as any)
          .eq("date", todayMyt)
          .limit(1);
        if (leaveToday && leaveToday.length > 0) {
          throw new Error("🚫 You are on approved leave today.");
        }
      }
      // ---- Device binding (with graceful fallback) ----
      let deviceFlagMissing = false;
      if (profile.is_device_binding_required) {
        try {
          const fingerprint = generateDeviceFingerprint();
          const currentDeviceId = resolvedDeviceId ?? profile.device_id;
          if (currentDeviceId && !isSameDevice(currentDeviceId, fingerprint)) {
            clearDeviceToken();
            setDeviceError("This account is locked to another device. Contact Admin.");
            throw new Error("Device mismatch");
          }
          if (!currentDeviceId) {
            // Best-effort bind — don't block check-in if it fails
            const { error: bindErr } = await supabase
              .from("staff_profiles")
              .update({ device_id: fingerprint })
              .eq("id", profile.id)
              .eq("user_id", user.id);
            if (bindErr) {
              deviceFlagMissing = true;
            } else {
              setResolvedDeviceId(fingerprint);
            }
          }
        } catch (e: any) {
          if (e?.message === "Device mismatch") throw e;
          // Fingerprint generation failed — flag and continue
          deviceFlagMissing = true;
        }
      }

      // ---- GPS (hard timeout already applied in getCurrentPosition) ----
      let pos: GeolocationPosition;
      try {
        pos = await getCurrentPosition(8000);
      } catch (gpsErr: any) {
        setGeoError(gpsErr?.message ?? "GPS Timeout");
        throw new Error(gpsErr?.message ?? "GPS Timeout");
      }

      const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, checkBranch.latitude, checkBranch.longitude);
      const allowedRadius = (isFreelancer || isAreaManager) ? AUTO_SUGGEST_RADIUS : checkBranch.radius_meters;
      if (dist > allowedRadius) {
        const msg = (isFreelancer || isAreaManager)
          ? `📍 You are not at the ${checkBranch.name} location.`
          : `You are ${Math.round(dist)}m away. Move closer to ${checkBranch.name}.`;
        setGeoError(msg);
        throw new Error("Out of range");
      }

      // ---- Late calc ----
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

      // ---- Double-entry detection (use MYT day boundary) ----
      const myt = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const todayMytIso = `${myt.getUTCFullYear()}-${String(myt.getUTCMonth() + 1).padStart(2, "0")}-${String(myt.getUTCDate()).padStart(2, "0")}T00:00:00+08:00`;
      const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
      const { data: existingToday } = await supabase
        .from("attendance_logs")
        .select("id, check_in_time, check_out_time")
        .eq("user_id", user.id)
        .gte("check_in_time", todayMytIso)
        .order("check_in_time", { ascending: false })
        .limit(5);

      const hasOpenLog = (existingToday ?? []).some((l) => !l.check_out_time);
      const hasRapidClick = (existingToday ?? []).some((l) => l.check_in_time >= sixtySecAgo);
      const isDoubleEntry = hasOpenLog || hasRapidClick;

      // ---- Build remarks ----
      let remarks: string | null = null;
      if (deviceFlagMissing) remarks = appendRemark(remarks, REMARK.ID_MISSING);
      if (isDoubleEntry) remarks = appendRemark(remarks, REMARK.DOUBLE_ENTRY);
      const isFullTime = profile.employment_type === "Monthly-FT" || profile.employment_type === "Hourly-FT";
      if (isFullTime && lateMinutes > 0) {
        remarks = appendRemark(remarks, `🚩 ${profile.name} - Forgot again/Attendance Issue`);
      }

      // ---- Insert ----
      const { data: insertedRow, error } = await supabase.from("attendance_logs").insert({
        user_id: user.id,
        branch_id: checkBranch.id,
        check_in_lat: pos.coords.latitude,
        check_in_long: pos.coords.longitude,
        status: (lateMinutes > 0 ? "late" : "on_time") as any,
        late_minutes: lateMinutes,
        manager_notes: remarks,
      }).select("*").single();
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("duplicate") || msg.includes("unique"))
          throw new Error("You are already clocked in. Refresh the page.");
        if (msg.includes("timeout") || msg.includes("network"))
          throw new Error("Database busy — please try again in a few seconds.");
        throw new Error(error.message || "Database error during check-in.");
      }
      supabase.functions.invoke("notify-attendance", { body: { record: insertedRow } })
        .catch(() => {});
      return { deviceFlagMissing, isDoubleEntry };
    },
    onSuccess: ({ deviceFlagMissing, isDoubleEntry }) => {
      queryClient.invalidateQueries({ queryKey: ["active-attendance", user?.id] });
      const parts: string[] = [];
      if (deviceFlagMissing) parts.push("flagged 'ID Missing'");
      if (isDoubleEntry) parts.push("flagged as possible double entry");
      toast({
        title: "Checked In!",
        description: parts.length
          ? `Recorded — ${parts.join(" & ")}. Admin will review.`
          : "Your attendance has been recorded.",
      });
    },
    onError: (err: Error) => {
      if (err.message !== "Device mismatch" && err.message !== "Out of range")
        toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in. Please log in again.");

      // Fetch the latest open log live — never trust stale React Query cache for checkout.
      const { data: openLogs, error: fetchErr } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user.id)
        .is("check_out_time", null)
        .order("check_in_time", { ascending: false })
        .limit(1);
      if (fetchErr) throw new Error(fetchErr.message || "Could not load your active session.");
      const openLog = openLogs?.[0];
      if (!openLog) throw new Error("No active session found. If it's past 8:30 PM, the system may have auto-checked you out. Contact your admin if your hours are wrong.");

      const checkIn = new Date(openLog.check_in_time);
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
      }).eq("id", openLog.id);
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("timeout") || msg.includes("network"))
          throw new Error("Database busy — please try again in a few seconds.");
        if (msg.includes("permission") || msg.includes("policy") || msg.includes("rls"))
          throw new Error("Permission denied — please log out and log back in.");
        throw new Error(error.message);
      }
      supabase.functions.invoke("notify-attendance", {
        body: { record: { ...openLog, check_out_time: now.toISOString() } },
      }).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-attendance", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["month-ot", user?.id] });
      toast({ title: "Checked Out!", description: "Have a great rest of the day." });
    },
    onError: (err: Error) => toast({ title: "Check-out failed", description: err.message, variant: "destructive" }),
  });

  // Show the page shell while profile loads — never block the UI behind a full-screen spinner.
  // Background queries (payslip, OT) load progressively.
  if (isLoading && !profile) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading your profile…</p>
        </div>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        <Alert variant="destructive">
          <AlertDescription className="space-y-1">
            <p className="font-medium">Staff profile not found.</p>
            <p className="text-xs">Your account is not linked to a staff profile yet. Ask your admin to assign your profile in the Staff page. If already done, try signing out and back in.</p>
            {user?.email && <p className="text-xs font-mono opacity-70">Account: {user.email}</p>}
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>Retry</Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>Sign Out</Button>
      </div>
    );
  }

  const effectiveRadius = activeBranch ? ((isFreelancer || isAreaManager) ? AUTO_SUGGEST_RADIUS : activeBranch.radius_meters) : null;
  const inRange = distance !== null && effectiveRadius !== null ? distance <= effectiveRadius : null;

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
      {(isAreaManager || isFreelancer) && !activeLog && (
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {isFreelancer ? "Which branch are you working at today?" : "Select Branch to Check In"}
              </p>
              {autoDetected && selectedBranchId && (
                <Badge variant="secondary" className="text-[10px] gap-1"><MapPin className="h-2.5 w-2.5" /> Detected</Badge>
              )}
            </div>
            <Select
              value={selectedBranchId}
              onValueChange={(v) => { setSelectedBranchId(v); setAutoDetected(false); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose any branch..." />
              </SelectTrigger>
              <SelectContent>
                {(isAreaManager ? allBranches : allBranchesFreelancer).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {gpsDenied && (
              <p className="text-xs text-muted-foreground">Please enable location for faster check-in.</p>
            )}
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

          {/* Timer — isolated component so only it re-renders every second */}
          {activeLog && <ClockTimer checkInTime={activeLog.check_in_time} />}

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
              disabled={!!activeLog || checkInMutation.isPending || ((isAreaManager || isFreelancer) && !selectedBranchId) || ((isAreaManager || isFreelancer) && inRange === false)}
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
        <Card className="rounded-xl border-t-2 border-t-primary/40">
          <CardContent className="p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto text-primary/70 mb-1" />
            <p className="text-lg font-bold tabular-nums">{profile.al_balance}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Leave Left</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-t-2 border-t-amber-400/60">
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-amber-500/70 mb-1" />
            <p className="text-lg font-bold tabular-nums">{monthOt.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">OT Hours</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-t-2 border-t-emerald-400/60">
          <CardContent className="p-3 text-center">
            <FileText className="h-4 w-4 mx-auto text-emerald-600/70 mb-1" />
            <p className="text-lg font-bold tabular-nums">
              {latestPayslip ? `RM${Number(latestPayslip.net_pay).toFixed(0)}` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">Last Pay</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Shifts */}
      {upcomingShifts.length > 0 && (
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" /> Upcoming Shifts
            </p>
            {upcomingShifts.map((s: any) => {
              const shiftDate = new Date(s.date + "T00:00:00");
              const isToday = s.date === format(new Date(), "yyyy-MM-dd");
              return (
                <div key={s.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${isToday ? "bg-primary/10 border border-primary/20" : "bg-muted/40"}`}>
                  <div>
                    <p className="font-medium">
                      {isToday ? "Today" : shiftDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    {s.notes && <p className="text-xs text-muted-foreground truncate max-w-[160px]">{s.notes}</p>}
                  </div>
                  <span className="tabular-nums text-xs font-mono text-muted-foreground">
                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Privacy Disclaimer */}
      <p className="text-[10px] text-muted-foreground text-center px-4 pb-4">
        📍 Location is tracked for travel claims and safety during working hours only. GPS tracking occurs only when you tap Clock In or Log Visit.
      </p>
    </div>
  );
};

export default StaffHome;
