import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Check, X, Clock, MapPin, Wallet, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addMonths } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type AttendanceLog = Tables<"attendance_logs"> & {
  payment_status?: "automatic" | "pending_approval" | "approved" | "rejected";
  manager_notes?: string | null;
};

type StatusFilter = "pending_approval" | "approved" | "rejected";

const AttendanceApprovals = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("pending_approval");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["approvals", filter],
    queryFn: async () => {
      const { data, error } = await (supabase.from("attendance_logs") as any)
        .select("*")
        .eq("payment_status", filter)
        .order("check_in_time", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AttendanceLog[];
    },
  });

  const userIds = useMemo(() => Array.from(new Set(logs.map((l) => l.user_id))), [logs]);
  const branchIds = useMemo(() => Array.from(new Set(logs.map((l) => l.branch_id))), [logs]);

  const { data: staffMap = {} } = useQuery({
    queryKey: ["approval-staff", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("user_id, name, staff_id")
        .in("user_id", userIds);
      if (error) throw error;
      const m: Record<string, { name: string; staff_id: string }> = {};
      data?.forEach((s) => { m[s.user_id] = { name: s.name, staff_id: s.staff_id }; });
      return m;
    },
    enabled: userIds.length > 0,
  });

  const { data: branchMap = {} } = useQuery({
    queryKey: ["approval-branches", branchIds.join(",")],
    queryFn: async () => {
      if (branchIds.length === 0) return {};
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .in("id", branchIds);
      if (error) throw error;
      const m: Record<string, string> = {};
      data?.forEach((b) => { m[b.id] = b.name; });
      return m;
    },
    enabled: branchIds.length > 0,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("attendance_logs")
        .update({ payment_status: status, manager_notes: notesDraft[id] ?? null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast({ title: vars.status === "approved" ? "Approved for pay" : "Rejected" });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending_approval", "approved", "rejected"] as StatusFilter[]).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === "pending_approval" ? "Pending" : s === "approved" ? "Approved" : "Rejected"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <CheckSquare className="h-8 w-8 opacity-30" />
              <p className="font-medium">No {filter === "pending_approval" ? "pending" : filter} records.</p>
              {filter === "pending_approval" && <p className="text-sm">All emergency check-ins have been reviewed.</p>}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const s = staffMap[log.user_id];
            const branchName = branchMap[log.branch_id];
            const isPending = filter === "pending_approval";
            return (
              <Card key={log.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-base">{s?.name ?? "Unknown"}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">{s?.staff_id ?? log.user_id.slice(0, 8)}</p>
                    </div>
                    <Badge variant="outline" className={
                      log.payment_status === "approved"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                        : log.payment_status === "rejected"
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : "bg-warning/10 text-warning border-warning/20"
                    }>
                      {log.payment_status === "pending_approval" ? "Pending" : log.payment_status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {branchName ?? "—"}
                    </p>
                    <p className="flex items-center gap-1 text-muted-foreground tabular-nums">
                      <Clock className="h-3 w-3 shrink-0" />
                      {new Date(log.check_in_time).toLocaleString()}
                      {log.check_out_time && ` → ${new Date(log.check_out_time).toLocaleTimeString()}`}
                    </p>
                  </div>
                  {log.net_hours > 0 && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Net hours: {Number(log.net_hours).toFixed(1)} • OT: {Number(log.ot_hours).toFixed(1)}
                    </p>
                  )}
                  {isPending ? (
                    <>
                      <Textarea
                        placeholder="Manager notes (optional)…"
                        value={notesDraft[log.id] ?? ""}
                        onChange={(e) => setNotesDraft((d) => ({ ...d, [log.id]: e.target.value }))}
                        className="text-sm"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: log.id, status: "approved" })}
                          disabled={updateStatus.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" /> Approve for Pay
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateStatus.mutate({ id: log.id, status: "rejected" })}
                          disabled={updateStatus.isPending}
                        >
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </>
                  ) : (
                    log.manager_notes && (
                      <div className="text-xs bg-muted p-2 rounded">
                        <span className="font-medium">Notes:</span> {log.manager_notes}
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SalaryAdvanceApprovals = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deductMonths, setDeductMonths] = useState<Record<string, string>>({});

  const nextMonth = format(addMonths(new Date(), 1), "yyyy-MM");

  const { data: advances = [], isLoading } = useQuery({
    queryKey: ["salary-advances-pending"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("salary_advances")
        .select("*, staff_profiles(name, staff_id, base_rate)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recentAdvances = [] } = useQuery({
    queryKey: ["salary-advances-recent"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("salary_advances")
        .select("*, staff_profiles(name, staff_id)")
        .neq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, deductMonth }: { id: string; deductMonth: string }) => {
      const { error } = await (supabase as any)
        .from("salary_advances")
        .update({
          status: "approved",
          approved_by: user!.id,
          approved_at: new Date().toISOString(),
          deduct_month: deductMonth,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-advances-pending"] });
      queryClient.invalidateQueries({ queryKey: ["salary-advances-recent"] });
      toast({ title: "Advance approved", description: "Will be deducted in the specified month." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("salary_advances")
        .update({ status: "rejected", approved_by: user!.id, approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-advances-pending"] });
      queryClient.invalidateQueries({ queryKey: ["salary-advances-recent"] });
      toast({ title: "Advance rejected" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    if (s === "rejected") return "bg-destructive/10 text-destructive border-destructive/20";
    if (s === "deducted") return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    return "bg-warning/10 text-warning border-warning/20";
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          Pending Requests
          {advances.length > 0 && <Badge variant="destructive">{advances.length}</Badge>}
        </h3>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
        ) : advances.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Wallet className="h-7 w-7 opacity-30" />
                <p className="font-medium">No pending advance requests.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {advances.map((adv: any) => {
              const maxAdvance = Number(adv.staff_profiles?.base_rate ?? 0) * 0.5;
              const pct = maxAdvance > 0 ? Math.round((Number(adv.amount) / maxAdvance) * 100) : 0;
              const dm = deductMonths[adv.id] ?? nextMonth;
              return (
                <Card key={adv.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{adv.staff_profiles?.name ?? "Unknown"}</CardTitle>
                        <p className="text-xs text-muted-foreground font-mono">{adv.staff_profiles?.staff_id}</p>
                      </div>
                      <Badge className="text-sm font-semibold">RM {Number(adv.amount).toFixed(2)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{adv.reason || "No reason provided."}</p>
                    {maxAdvance > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {pct}% of base salary (max 50% = RM {maxAdvance.toFixed(2)})
                        {pct > 50 && <span className="ml-1 text-destructive font-medium">— exceeds limit</span>}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Requested: {new Date(adv.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="space-y-1">
                        <Label className="text-xs">Deduct Month</Label>
                        <Input
                          type="month"
                          value={dm}
                          onChange={(e) => setDeductMonths((prev) => ({ ...prev, [adv.id]: e.target.value }))}
                          className="h-8 w-40 text-sm"
                        />
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate({ id: adv.id, deductMonth: dm })}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectMutation.mutate(adv.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Decisions</h3>
        {recentAdvances.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No processed requests yet.</p>
        ) : (
          <div className="space-y-2">
            {recentAdvances.map((adv: any) => (
              <div key={adv.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{adv.staff_profiles?.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    RM {Number(adv.amount).toFixed(2)}
                    {adv.deduct_month ? ` • Deduct: ${adv.deduct_month}` : ""}
                    {" • "}{new Date(adv.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className={statusColor(adv.status)}>
                  {adv.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Approvals = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CheckSquare className="h-6 w-6" /> Approvals
        </h1>
        <p className="text-muted-foreground">Review attendance pay approvals and salary advance requests</p>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance Pay</TabsTrigger>
          <TabsTrigger value="advances">Salary Advances</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance" className="mt-4">
          <AttendanceApprovals />
        </TabsContent>
        <TabsContent value="advances" className="mt-4">
          <SalaryAdvanceApprovals />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Approvals;
