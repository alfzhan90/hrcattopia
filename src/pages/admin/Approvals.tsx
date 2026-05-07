import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Check, X, Clock, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

type AttendanceLog = Tables<"attendance_logs"> & {
  payment_status?: "automatic" | "pending_approval" | "approved" | "rejected";
  manager_notes?: string | null;
};

type StatusFilter = "pending_approval" | "approved" | "rejected";

const Approvals = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("pending_approval");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["approvals", filter],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("attendance_logs") as any)
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
        .update({
          payment_status: status,
          manager_notes: notesDraft[id] ?? null,
        } as any)
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CheckSquare className="h-6 w-6" /> Pay Approvals
        </h1>
        <p className="text-muted-foreground">Review emergency check-ins that need manager approval</p>
      </div>

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

export default Approvals;
