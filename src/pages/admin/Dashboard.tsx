import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Clock, CalendarOff, AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { getPayPeriod } from "@/lib/payroll";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const Dashboard = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const currentMonth = format(new Date(), "yyyy-MM");
  const period = getPayPeriod(currentMonth);

  // Staff present today (checked in, no checkout)
  const { data: presentToday = [], isLoading: loadingPresent } = useQuery({
    queryKey: ["dash-present"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("user_id, status, check_in_time")
        .is("check_out_time", null)
        .gte("check_in_time", `${today}T00:00:00`);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  // Late today
  const lateToday = presentToday.filter((l) => l.status === "late").length;

  // All attendance today (including checked-out) for total count
  const { data: allToday = [] } = useQuery({
    queryKey: ["dash-all-today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("id, status")
        .gte("check_in_time", `${today}T00:00:00`);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  // Pending leave requests
  const { data: pendingLeaves = [], isLoading: loadingLeaves } = useQuery({
    queryKey: ["dash-pending-leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_records")
        .select("id, leave_type, date, staff_profiles!inner(name)")
        .eq("status", "pending" as any)
        .order("date");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Shifts with no staff in next 3 days
  const { data: emptyShiftDates = [], isLoading: loadingShifts } = useQuery({
    queryKey: ["dash-empty-shifts"],
    queryFn: async () => {
      const in3 = format(new Date(Date.now() + 3 * 86400000), "yyyy-MM-dd");
      const { data: branches, error: bErr } = await supabase.from("branches").select("id, name");
      if (bErr) throw bErr;
      const { data: schedules, error: sErr } = await supabase
        .from("schedules")
        .select("date, branch_id")
        .gte("date", today)
        .lte("date", in3);
      if (sErr) throw sErr;
      const scheduledDates = new Set((schedules ?? []).map((s) => `${s.date}__${s.branch_id}`));
      const alerts: { date: string; branchName: string }[] = [];
      for (let i = 0; i < 3; i++) {
        const d = format(new Date(Date.now() + i * 86400000), "yyyy-MM-dd");
        for (const b of (branches ?? [])) {
          if (!scheduledDates.has(`${d}__${b.id}`)) {
            alerts.push({ date: d, branchName: b.name });
          }
        }
      }
      return alerts;
    },
  });

  // Current payroll cycle summary
  const { data: payrollSummary } = useQuery({
    queryKey: ["dash-payroll-summary", currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("net_pay, status")
        .eq("month", `${currentMonth}-01`);
      if (error) throw error;
      const runs = data ?? [];
      return {
        total: runs.reduce((s, r) => s + Number(r.net_pay), 0),
        released: runs.filter((r) => r.status === "released").length,
        draft: runs.filter((r) => r.status === "draft").length,
        count: runs.length,
      };
    },
  });

  // Recent attendance (last 5)
  const { data: recentLogs = [], isLoading: loadingRecent } = useQuery({
    queryKey: ["dash-recent-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("id, check_in_time, status, user_id, branch_id")
        .gte("check_in_time", new Date(Date.now() - 24 * 3600000).toISOString())
        .order("check_in_time", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  const { data: staffMap = {} } = useQuery({
    queryKey: ["dash-staff-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("user_id, name, staff_id");
      if (error) throw error;
      const m: Record<string, { name: string; staff_id: string }> = {};
      (data ?? []).forEach((s) => { m[s.user_id] = s; });
      return m;
    },
  });

  // 7-day attendance trend
  const { data: weekTrend = [] } = useQuery({
    queryKey: ["dash-week-trend"],
    queryFn: async () => {
      const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
      const since = format(subDays(new Date(), 6), "yyyy-MM-dd");
      const { data } = await supabase.from("attendance_logs").select("check_in_time, status").gte("check_in_time", since);
      return days.map((d) => {
        const ds = format(d, "yyyy-MM-dd");
        const dayLogs = (data ?? []).filter((l) => l.check_in_time.startsWith(ds));
        return { day: format(d, "EEE"), total: dayLogs.length, late: dayLogs.filter((l) => l.status === "late").length };
      });
    },
    staleTime: 1000 * 60 * 10,
  });

  // Leave type breakdown — current month
  const { data: leaveBreakdown = [] } = useQuery({
    queryKey: ["dash-leave-breakdown", currentMonth],
    queryFn: async () => {
      const { data } = await supabase.from("leave_records").select("leave_type")
        .gte("date", `${currentMonth}-01`).lte("date", `${currentMonth}-31`).eq("status", "approved" as any);
      const counts: Record<string, number> = {};
      for (const r of data ?? []) counts[r.leave_type] = (counts[r.leave_type] ?? 0) + 1;
      return Object.entries(counts).map(([type, count]) => ({ type, count }));
    },
    staleTime: 1000 * 60 * 15,
  });

  // Headcount summary
  const { data: headcount } = useQuery({
    queryKey: ["dash-headcount"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("employment_type, employment_status");
      const all = data ?? [];
      const active = all.filter((s) => (s as any).employment_status === "active" || !(s as any).employment_status);
      const byType: Record<string, number> = {};
      for (const s of active) byType[s.employment_type] = (byType[s.employment_type] ?? 0) + 1;
      return { total: active.length, byType };
    },
    staleTime: 1000 * 60 * 30,
  });

  const LEAVE_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444"];

  const kpis = [
    {
      label: "Present Today",
      value: loadingPresent ? null : presentToday.length,
      sub: `${allToday.length} total check-ins`,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-t-primary/50",
    },
    {
      label: "Late Today",
      value: loadingPresent ? null : lateToday,
      sub: lateToday > 0 ? "Needs attention" : "All on time",
      icon: Clock,
      color: lateToday > 0 ? "text-destructive" : "text-emerald-600",
      bg: lateToday > 0 ? "bg-destructive/10" : "bg-emerald-500/10",
      border: lateToday > 0 ? "border-t-destructive/50" : "border-t-emerald-500/50",
    },
    {
      label: "Pending Leaves",
      value: loadingLeaves ? null : pendingLeaves.length,
      sub: pendingLeaves.length > 0 ? "Awaiting approval" : "All cleared",
      icon: CalendarOff,
      color: pendingLeaves.length > 0 ? "text-warning" : "text-emerald-600",
      bg: pendingLeaves.length > 0 ? "bg-warning/10" : "bg-emerald-500/10",
      border: pendingLeaves.length > 0 ? "border-t-warning/50" : "border-t-emerald-500/50",
    },
    {
      label: "Unscheduled (3d)",
      value: loadingShifts ? null : emptyShiftDates.length,
      sub: emptyShiftDates.length > 0 ? "Branches need staff" : "Fully covered",
      icon: AlertTriangle,
      color: emptyShiftDates.length > 0 ? "text-destructive" : "text-emerald-600",
      bg: emptyShiftDates.length > 0 ? "bg-destructive/10" : "bg-emerald-500/10",
      border: emptyShiftDates.length > 0 ? "border-t-destructive/50" : "border-t-emerald-500/50",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">{format(new Date(), "EEEE, d MMMM yyyy")} — Overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, color, bg, border }) => (
          <Card key={label} className={`rounded-xl border-t-2 ${border}`}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                {value === null ? (
                  <Skeleton className="h-7 w-10 mt-0.5" />
                ) : (
                  <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payroll Summary */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              Payroll — {format(new Date(`${currentMonth}-01`), "MMMM yyyy")}
            </p>
            {payrollSummary ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Net Pay</span>
                  <span className="font-bold tabular-nums">RM {payrollSummary.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Staff Count</span>
                  <span className="tabular-nums">{payrollSummary.count}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  {payrollSummary.released > 0 && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />{payrollSummary.released} Released
                    </Badge>
                  )}
                  {payrollSummary.draft > 0 && (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                      {payrollSummary.draft} Draft
                    </Badge>
                  )}
                  {payrollSummary.count === 0 && (
                    <span className="text-xs text-muted-foreground">Not calculated yet</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Leaves */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarOff className="h-4 w-4 text-primary" />
              Pending Leave Requests
            </p>
            {loadingLeaves ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
              </div>
            ) : pendingLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            ) : (
              <div className="space-y-1.5">
                {pendingLeaves.slice(0, 5).map((lr: any) => (
                  <div key={lr.id} className="flex items-center justify-between text-sm rounded-lg bg-muted/40 px-3 py-2">
                    <span className="font-medium truncate">{lr.staff_profiles?.name ?? "—"}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">{lr.leave_type}</Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">{lr.date}</span>
                    </div>
                  </div>
                ))}
                {pendingLeaves.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+{pendingLeaves.length - 5} more</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Check-Ins */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              Recent Check-Ins (24h)
            </p>
            {loadingRecent ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
              </div>
            ) : recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No check-ins yet today.</p>
            ) : (
              <div className="space-y-1.5">
                {recentLogs.map((log) => {
                  const s = staffMap[log.user_id];
                  return (
                    <div key={log.id} className="flex items-center justify-between text-sm rounded-lg bg-muted/40 px-3 py-2">
                      <div>
                        <p className="font-medium">{s?.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s?.staff_id ?? "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="tabular-nums text-xs">{format(new Date(log.check_in_time), "HH:mm")}</p>
                        <Badge variant="outline" className={`text-[10px] ${log.status === "on_time" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                          {log.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Empty Shift Alerts */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Unscheduled Branches (Next 3 Days)
            </p>
            {loadingShifts ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
              </div>
            ) : emptyShiftDates.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                All branches covered for the next 3 days.
              </div>
            ) : (
              <div className="space-y-1.5">
                {emptyShiftDates.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2">
                    <span className="font-medium text-destructive">{item.branchName}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {item.date === today ? "Today" : format(new Date(item.date + "T00:00:00"), "EEE, d MMM")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 7-day attendance trend */}
        <Card className="rounded-xl lg:col-span-2">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" /> Attendance — Last 7 Days
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weekTrend} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="total" name="Check-ins" fill="hsl(var(--primary))" radius={[4,4,0,0]} opacity={0.85} />
                <Bar dataKey="late" name="Late" fill="#ef4444" radius={[4,4,0,0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leave breakdown */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarOff className="h-4 w-4 text-primary" /> Leave This Month
            </p>
            {leaveBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground pt-4">No approved leaves.</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={leaveBreakdown} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={55} paddingAngle={3}>
                    {leaveBreakdown.map((_, i) => <Cell key={i} fill={LEAVE_COLORS[i % LEAVE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Headcount summary */}
      {headcount && (
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" /> Headcount — {headcount.total} Active Staff
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(headcount.byType).map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-sm px-3 py-1">
                  {type} <span className="font-bold ml-1.5 tabular-nums">{count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
