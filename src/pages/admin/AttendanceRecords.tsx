import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Search, AlertTriangle, Bot, Flag, Trash2, History, ClipboardList, Download } from "lucide-react";
import { format, subDays } from "date-fns";
import { classifyRemark, type RemarkKind } from "@/lib/attendance-remarks";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

type AttendanceLog = Tables<"attendance_logs">;
type StaffProfile = Tables<"staff_profiles">;
type Branch = Tables<"branches">;

const AuditHistoryDialog = ({ logId, onClose }: { logId: string | null; onClose: () => void }) => {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit-history", logId],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_audit_logs" as any)
        .select("*")
        .eq("attendance_log_id", logId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
    enabled: !!logId,
  });

  return (
    <Dialog open={!!logId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Audit History</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}</div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No audit entries for this record.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {entries.map((e: any) => (
              <div key={e.id} className="rounded-lg border p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={e.action === "delete" ? "bg-destructive/10 text-destructive border-destructive/20" : e.action === "add" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-primary/10 text-primary border-primary/20"}>
                    {e.action}
                  </Badge>
                  <span className="text-muted-foreground tabular-nums">{format(new Date(e.created_at), "dd MMM yyyy HH:mm")}</span>
                </div>
                {e.details && (
                  <pre className="text-muted-foreground font-mono text-[10px] whitespace-pre-wrap break-all">{JSON.stringify(e.details, null, 2)}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const AttendanceRecords = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [branchFilter, setBranchFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [flagFilter, setFlagFilter] = useState<
    "all" | "any" | "double_entry" | "auto_checkout" | "full_time_issue" | "historical_missing" | "historical_double" | "frequent_issue"
  >("all");
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editLog, setEditLog] = useState<any>(null);

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");

  // Add new log dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addStaffId, setAddStaffId] = useState("");
  const [addDate, setAddDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [addCheckIn, setAddCheckIn] = useState("09:30");
  const [addCheckOut, setAddCheckOut] = useState("18:30");

  // Audit history dialog
  const [auditLogId, setAuditLogId] = useState<string | null>(null);

  const writeAudit = (attendance_log_id: string | null, action: "add" | "edit" | "delete", details: object) => {
    supabase.from("attendance_audit_logs" as any).insert({
      attendance_log_id,
      action,
      actor_id: user?.id ?? null,
      details,
    } as any).then(() => {});
  };

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("*").order("name");
      if (error) throw error;
      return data as StaffProfile[];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["attendance-records", dateFrom, dateTo, branchFilter],
    queryFn: async () => {
      let q = supabase
        .from("attendance_logs")
        .select("*")
        .gte("check_in_time", `${dateFrom}T00:00:00`)
        .lte("check_in_time", `${dateTo}T23:59:59`)
        .order("check_in_time", { ascending: false });

      if (branchFilter !== "all") {
        q = q.eq("branch_id", branchFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as AttendanceLog[];
    },
  });

  const staffMap = Object.fromEntries(staff.map((s) => [s.user_id, s]));
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b]));

  const exportCsv = () => {
    const header = ["Date", "Staff ID", "Name", "Clock In", "Clock Out", "Total Hrs", "Net Hrs", "OT Hrs", "Status", "Flags"];
    const rows = filteredLogs.map((log) => {
      const s = staffMap[log.user_id];
      const totalHrs = log.check_out_time
        ? ((new Date(log.check_out_time).getTime() - new Date(log.check_in_time).getTime()) / 3600000).toFixed(2)
        : "";
      return [
        format(new Date(log.check_in_time), "dd/MM/yyyy"),
        s?.staff_id ?? "",
        s?.name ?? "Unknown",
        format(new Date(log.check_in_time), "HH:mm"),
        log.check_out_time ? format(new Date(log.check_out_time), "HH:mm") : "",
        totalHrs,
        Number(log.net_hours).toFixed(2),
        Number(log.ot_hours).toFixed(2),
        log.status,
        log.manager_notes ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    if (searchTerm) {
      const s = staffMap[log.user_id];
      if (!s) return false;
      const term = searchTerm.toLowerCase();
      if (!s.name.toLowerCase().includes(term) && !s.staff_id.toLowerCase().includes(term)) return false;
    }
    if (flagFilter !== "all") {
      const kinds = classifyRemark(log.manager_notes);
      const hasFlag = kinds.length > 0 && !(kinds.length === 1 && kinds[0] === "manual");
      if (flagFilter === "any") {
        if (!hasFlag) return false;
      } else if (!kinds.includes(flagFilter as RemarkKind)) {
        return false;
      }
    }
    return true;
  });

  const flagBadges = (notes: string | null) => {
    const kinds = classifyRemark(notes);
    if (kinds.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <div className="flex flex-wrap gap-1 max-w-[260px]">
        {kinds.map((k) => {
          if (k === "double_entry")
            return (
              <Badge key={k} variant="destructive" className="text-[10px] gap-1">
                <AlertTriangle className="h-3 w-3" /> Double Entry
              </Badge>
            );
          if (k === "auto_checkout")
            return (
              <Badge key={k} variant="secondary" className="text-[10px] gap-1 bg-info/15 text-info border-info/30">
                <Bot className="h-3 w-3" /> Auto-Checkout
              </Badge>
            );
          if (k === "full_time_issue")
            return (
              <Badge key={k} variant="secondary" className="text-[10px] gap-1 bg-warning/15 text-warning border-warning/30">
                <Flag className="h-3 w-3" /> FT Issue
              </Badge>
            );
          if (k === "historical_missing")
            return (
              <Badge key={k} variant="secondary" className="text-[10px] gap-1 bg-warning/15 text-warning border-warning/30">
                <History className="h-3 w-3" /> Hist: Missing Logout
              </Badge>
            );
          if (k === "historical_double")
            return (
              <Badge key={k} variant="secondary" className="text-[10px] gap-1 bg-warning/15 text-warning border-warning/30">
                <History className="h-3 w-3" /> Hist: Double Entry
              </Badge>
            );
          if (k === "frequent_issue")
            return (
              <Badge key={k} variant="destructive" className="text-[10px] gap-1">
                <Flag className="h-3 w-3" /> Frequent Issue
              </Badge>
            );
          if (k === "id_missing")
            return <Badge key={k} variant="outline" className="text-[10px]">ID Missing</Badge>;
          return <Badge key={k} variant="outline" className="text-[10px]">Note</Badge>;
        })}
      </div>
    );
  };

  const openEdit = (log: AttendanceLog) => {
    setEditLog(log);
    setEditCheckIn(format(new Date(log.check_in_time), "yyyy-MM-dd'T'HH:mm"));
    setEditCheckOut(log.check_out_time ? format(new Date(log.check_out_time), "yyyy-MM-dd'T'HH:mm") : "");
    setEditOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editLog) return;
      const checkIn = new Date(editCheckIn);
      const checkOut = editCheckOut ? new Date(editCheckOut) : null;

      let netHours = 0, restHours = 0, regularHours = 0, otHours = 0;
      if (checkOut) {
        const totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        restHours = Math.floor(totalHours / 5);
        netHours = Math.max(totalHours - restHours, 0);
        regularHours = Math.min(netHours, 8);
        otHours = Math.max(netHours - 8, 0);
      }

      const { error } = await supabase
        .from("attendance_logs")
        .update({
          check_in_time: checkIn.toISOString(),
          check_out_time: checkOut?.toISOString() || null,
          net_hours: Math.round(netHours * 100) / 100,
          rest_hours: Math.round(restHours * 100) / 100,
          regular_hours: Math.round(regularHours * 100) / 100,
          ot_hours: Math.round(otHours * 100) / 100,
        })
        .eq("id", editLog.id);
      if (error) throw error;
      writeAudit(editLog.id, "edit", {
        before: { check_in_time: editLog.check_in_time, check_out_time: editLog.check_out_time },
        after: { check_in_time: checkIn.toISOString(), check_out_time: checkOut?.toISOString() ?? null },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      setEditOpen(false);
      toast({ title: "Updated", description: "Attendance log corrected." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const logToDelete = logs.find((l) => l.id === id);
      const { error } = await supabase.from("attendance_logs").delete().eq("id", id);
      if (error) throw error;
      if (logToDelete) {
        writeAudit(null, "delete", {
          deleted_id: id,
          check_in_time: logToDelete.check_in_time,
          check_out_time: logToDelete.check_out_time,
          user_id: logToDelete.user_id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      setDeleteId(null);
      toast({ title: "Deleted", description: "Attendance record permanently removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const staffProfile = staff.find((s) => s.id === addStaffId);
      if (!staffProfile) throw new Error("Select a staff member");
      if (!staffProfile.branch_id) throw new Error("Staff has no branch assigned");

      const checkIn = new Date(`${addDate}T${addCheckIn}:00`);
      const checkOut = new Date(`${addDate}T${addCheckOut}:00`);
      const totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      const restHours = Math.floor(totalHours / 5);
      const netHours = Math.max(totalHours - restHours, 0);
      const regularHours = Math.min(netHours, 8);
      const otHours = Math.max(netHours - 8, 0);

      const { data: inserted, error } = await supabase.from("attendance_logs").insert({
        user_id: staffProfile.user_id,
        branch_id: staffProfile.branch_id,
        check_in_time: checkIn.toISOString(),
        check_out_time: checkOut.toISOString(),
        status: "on_time",
        net_hours: Math.round(netHours * 100) / 100,
        rest_hours: Math.round(restHours * 100) / 100,
        regular_hours: Math.round(regularHours * 100) / 100,
        ot_hours: Math.round(otHours * 100) / 100,
      }).select("id").single();
      if (error) throw error;
      writeAudit(inserted?.id ?? null, "add", {
        staff_name: staffProfile.name,
        check_in_time: checkIn.toISOString(),
        check_out_time: checkOut.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      setAddOpen(false);
      toast({ title: "Added", description: "New attendance log created." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Attendance Records</h1>
          <p className="text-muted-foreground">View and edit all attendance logs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={filteredLogs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Log
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Branch</Label>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Flags</Label>
          <Select value={flagFilter} onValueChange={(v: any) => setFlagFilter(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Records</SelectItem>
              <SelectItem value="any">Any Flag</SelectItem>
              <SelectItem value="double_entry">Errors (Double Entry)</SelectItem>
              <SelectItem value="auto_checkout">Auto-Logs</SelectItem>
              <SelectItem value="full_time_issue">Full-Time Issues</SelectItem>
              <SelectItem value="historical_missing">Historical: Missing Logout</SelectItem>
              <SelectItem value="historical_double">Historical: Double Entry</SelectItem>
              <SelectItem value="frequent_issue">Frequent Issue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Name or Staff ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Staff ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Total Hrs</TableHead>
              <TableHead>Net Hrs</TableHead>
              <TableHead>OT Hrs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issues / Flags</TableHead>
              <TableHead className="w-[110px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 11 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ClipboardList className="h-8 w-8 opacity-30" />
                    <p className="font-medium">No records found.</p>
                    <p className="text-sm">Try adjusting the date range or filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
                const s = staffMap[log.user_id];
                const totalHrs = log.check_out_time
                  ? ((new Date(log.check_out_time).getTime() - new Date(log.check_in_time).getTime()) / 3600000).toFixed(1)
                  : "—";
                return (
                  <TableRow key={log.id}>
                    <TableCell className="tabular-nums">{format(new Date(log.check_in_time), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-mono text-xs">{s?.staff_id || "—"}</TableCell>
                    <TableCell>{s?.name || "Unknown"}</TableCell>
                    <TableCell className="tabular-nums">{format(new Date(log.check_in_time), "HH:mm")}</TableCell>
                    <TableCell className="tabular-nums">{log.check_out_time ? format(new Date(log.check_out_time), "HH:mm") : "—"}</TableCell>
                    <TableCell className="tabular-nums">{totalHrs}</TableCell>
                    <TableCell className="tabular-nums">{Number(log.net_hours).toFixed(1)}</TableCell>
                    <TableCell className="tabular-nums">{Number(log.ot_hours).toFixed(1)}</TableCell>
                    <TableCell>
                      {log.status === "late" ? (
                        <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                          Late{log.late_waived ? " (Waived)" : ""}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/20">On Time</Badge>
                      )}
                    </TableCell>
                    <TableCell>{flagBadges(log.manager_notes)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(log)} aria-label="Edit log">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setAuditLogId(log.id)} aria-label="View audit history">
                          <History className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(log.id)}
                            aria-label="Delete log"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance Log</DialogTitle>
          </DialogHeader>
          {editLog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {staffMap[editLog.user_id]?.name} ({staffMap[editLog.user_id]?.staff_id})
              </p>
              <div className="space-y-2">
                <Label>Clock In</Label>
                <Input type="datetime-local" value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Clock Out</Label>
                <Input type="datetime-local" value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Missing Attendance Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff Member</Label>
              <Select value={addStaffId} onValueChange={setAddStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.staff_id} — {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Clock In</Label>
                <Input type="time" value={addCheckIn} onChange={(e) => setAddCheckIn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Clock Out</Label>
                <Input type="time" value={addCheckOut} onChange={(e) => setAddCheckOut(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Adding..." : "Add Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit history dialog */}
      <AuditHistoryDialog logId={auditLogId} onClose={() => setAuditLogId(null)} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attendance record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this attendance record? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleteId) deleteMutation.mutate(deleteId);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AttendanceRecords;
