import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Search } from "lucide-react";
import { format, subDays } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type AttendanceLog = Tables<"attendance_logs">;
type StaffProfile = Tables<"staff_profiles">;
type Branch = Tables<"branches">;

const AttendanceRecords = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [branchFilter, setBranchFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editLog, setEditLog] = useState<any>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");

  // Add new log dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addStaffId, setAddStaffId] = useState("");
  const [addDate, setAddDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [addCheckIn, setAddCheckIn] = useState("09:30");
  const [addCheckOut, setAddCheckOut] = useState("18:30");

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

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const s = staffMap[log.user_id];
    if (!s) return false;
    const term = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.staff_id.toLowerCase().includes(term);
  });

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

      const { error } = await supabase.from("attendance_logs").insert({
        user_id: staffProfile.user_id,
        branch_id: staffProfile.branch_id,
        check_in_time: checkIn.toISOString(),
        check_out_time: checkOut.toISOString(),
        status: "on_time",
        net_hours: Math.round(netHours * 100) / 100,
        rest_hours: Math.round(restHours * 100) / 100,
        regular_hours: Math.round(regularHours * 100) / 100,
        ot_hours: Math.round(otHours * 100) / 100,
      });
      if (error) throw error;
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
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Log
        </Button>
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
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No records found.</TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
                const s = staffMap[log.user_id];
                const totalHrs = log.check_out_time
                  ? ((new Date(log.check_out_time).getTime() - new Date(log.check_in_time).getTime()) / 3600000).toFixed(1)
                  : "—";
                return (
                  <TableRow key={log.id}>
                    <TableCell>{format(new Date(log.check_in_time), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-mono text-xs">{s?.staff_id || "—"}</TableCell>
                    <TableCell>{s?.name || "Unknown"}</TableCell>
                    <TableCell>{format(new Date(log.check_in_time), "HH:mm")}</TableCell>
                    <TableCell>{log.check_out_time ? format(new Date(log.check_out_time), "HH:mm") : "—"}</TableCell>
                    <TableCell>{totalHrs}</TableCell>
                    <TableCell>{Number(log.net_hours).toFixed(1)}</TableCell>
                    <TableCell>{Number(log.ot_hours).toFixed(1)}</TableCell>
                    <TableCell>
                      {log.status === "late" ? (
                        <Badge variant="destructive" className="text-xs">
                          Late{log.late_waived ? " (Waived)" : ""}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">On Time</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(log)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
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
    </div>
  );
};

export default AttendanceRecords;
