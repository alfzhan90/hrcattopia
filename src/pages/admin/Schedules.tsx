import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Plus, Trash2, Clock, AlertTriangle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"schedules">;
type StaffProfile = Tables<"staff_profiles">;
type Branch = Tables<"branches">;

const formatDate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const Schedules = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [form, setForm] = useState({
    staff_profile_id: "",
    branch_id: "",
    date: formatDate(new Date()),
    start_time: "09:30",
    end_time: "18:30",
    notes: "",
  });

  // 14-day window
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const endDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 13);
    return d;
  }, [today]);

  const dateRange = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [today]);

  // All branches — admins and area managers can plan across every branch
  const { data: managedBranches = [] } = useQuery({
    queryKey: ["planner-branches", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data as Branch[];
    },
    enabled: !!user,
  });

  // All active staff (including freelancers) — visible to admins and area managers
  const { data: staff = [] } = useQuery({
    queryKey: ["sched-staff-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("*")
        .eq("employment_status", "active")
        .order("name");
      if (error) throw error;
      return data as StaffProfile[];
    },
    enabled: !!user,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules", formatDate(today), formatDate(endDate)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .gte("date", formatDate(today))
        .lte("date", formatDate(endDate))
        .order("date")
        .order("start_time");
      if (error) throw error;
      return data as Schedule[];
    },
    enabled: !!user,
  });

  const staffMap = useMemo(() => {
    const m: Record<string, StaffProfile> = {};
    staff.forEach((s) => { m[s.id] = s; });
    return m;
  }, [staff]);

  const branchMap = useMemo(() => {
    const m: Record<string, Branch> = {};
    managedBranches.forEach((b) => { m[b.id] = b; });
    return m;
  }, [managedBranches]);

  // Branch filter defaults to "all" for both admins and area managers


  const filteredSchedules = useMemo(() => {
    if (branchFilter === "all") return schedules;
    return schedules.filter((s) => s.branch_id === branchFilter);
  }, [schedules, branchFilter]);

  const schedulesByDate = useMemo(() => {
    const m: Record<string, Schedule[]> = {};
    filteredSchedules.forEach((s) => {
      if (!m[s.date]) m[s.date] = [];
      m[s.date].push(s);
    });
    return m;
  }, [filteredSchedules]);

  const urgentThreshold = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 2); // today + next 2 days = 3 day window
    return d;
  }, [today]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.staff_profile_id || !form.branch_id || !form.date) {
        throw new Error("Please fill all required fields.");
      }
      const { error } = await supabase.from("schedules").insert({
        staff_profile_id: form.staff_profile_id,
        branch_id: form.branch_id,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        notes: form.notes || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Shift scheduled" });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setOpen(false);
      setForm((f) => ({ ...f, notes: "" }));
    },
    onError: (err: Error) => {
      toast({ title: "Could not schedule shift", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Shift removed" });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not delete", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6" /> Shift Planner
          </h1>
          <p className="text-muted-foreground">14-day schedule overview</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Schedule Shift
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule a Shift</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Staff Member</Label>
                <Select value={form.staff_profile_id} onValueChange={(v) => setForm((f) => ({ ...f, staff_profile_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.staff_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Branch</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm((f) => ({ ...f, branch_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {managedBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  min={formatDate(today)}
                  max={formatDate(endDate)}
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <Label>End</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Save Shift"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Branch filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Label className="text-sm shrink-0">Filter by Branch</Label>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="All branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {managedBranches.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {branchFilter !== "all" && (
          <p className="text-xs text-muted-foreground">
            Showing shifts for {branchMap[branchFilter]?.name ?? "selected branch"}
          </p>
        )}
      </div>




      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {dateRange.map((d) => {
          const key = formatDate(d);
          const items = schedulesByDate[key] || [];
          const isToday = key === formatDate(today);
          const isWithin3Days = d.getTime() <= urgentThreshold.getTime();
          const isUrgent = isWithin3Days && items.length === 0;
          return (
            <Card
              key={key}
              className={
                isUrgent
                  ? "border-2 border-destructive bg-destructive/5"
                  : isToday
                  ? "border-primary"
                  : ""
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span>
                    {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <div className="flex items-center gap-1">
                    {isToday && <Badge variant="default" className="text-xs">Today</Badge>}
                    {isUrgent && (
                      <Badge variant="destructive" className="text-xs flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> URGENT: No Staff
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 ? (
                  <p className={`text-xs ${isUrgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {isUrgent ? "No staff scheduled — fill ASAP" : "No shifts"}
                  </p>
                ) : (
                  items.map((s) => {
                    const sp = staffMap[s.staff_profile_id];
                    const br = branchMap[s.branch_id];
                    return (
                      <div key={s.id} className="text-xs border rounded p-2 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {sp?.name ?? "—"}: {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                          </p>
                          {branchFilter === "all" && (
                            <p className="text-muted-foreground truncate flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {br?.name ?? "—"}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => deleteMutation.mutate(s.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Schedules;
