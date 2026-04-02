import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";
import { format } from "date-fns";
import { calcRestHours, calcNetHours, calcDailyOt } from "@/lib/payroll";

const AttendanceCorrection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [editLog, setEditLog] = useState<any>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editRestHours, setEditRestHours] = useState("");
  const [editNetHours, setEditNetHours] = useState("");
  const [editOtHours, setEditOtHours] = useState("");

  const { data: staffMap = {} } = useQuery({
    queryKey: ["staff-map-payroll"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("user_id, name, staff_id");
      if (error) throw error;
      const map: Record<string, { name: string; staff_id: string }> = {};
      data?.forEach((s) => { map[s.user_id] = { name: s.name, staff_id: s.staff_id }; });
      return map;
    },
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["attendance-correction", selectedDate],
    queryFn: async () => {
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("*")
        .gte("check_in_time", selectedDate)
        .lt("check_in_time", format(nextDay, "yyyy-MM-dd"))
        .order("check_in_time");
      if (error) throw error;
      return data;
    },
  });

  // Auto-recalculate when check-in/out changes
  const recalculate = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return;
    const totalHours = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60);
    if (totalHours <= 0) return;
    const rest = calcRestHours(totalHours);
    const net = calcNetHours(totalHours);
    const ot = calcDailyOt(net);
    setEditRestHours(rest.toFixed(2));
    setEditNetHours(net.toFixed(2));
    setEditOtHours(ot.toFixed(2));
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, checkIn, checkOut, restHours, netHours, otHours }: {
      id: string; checkIn: string; checkOut: string;
      restHours: number; netHours: number; otHours: number;
    }) => {
      const checkInDate = new Date(checkIn);
      const updates: any = { check_in_time: checkInDate.toISOString() };

      if (checkOut) {
        const checkOutDate = new Date(checkOut);
        updates.check_out_time = checkOutDate.toISOString();
        updates.rest_hours = Math.round(restHours * 100) / 100;
        updates.net_hours = Math.round(netHours * 100) / 100;
        updates.regular_hours = Math.round(Math.min(netHours, 8) * 100) / 100;
        updates.ot_hours = Math.round(otHours * 100) / 100;
      }

      const { error } = await supabase.from("attendance_logs").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-correction"] });
      toast({ title: "Updated", description: "Attendance log corrected." });
      setEditLog(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openEdit = (log: any) => {
    setEditLog(log);
    setEditCheckIn(format(new Date(log.check_in_time), "yyyy-MM-dd'T'HH:mm"));
    setEditCheckOut(log.check_out_time ? format(new Date(log.check_out_time), "yyyy-MM-dd'T'HH:mm") : "");
    setEditRestHours(Number(log.rest_hours ?? 0).toFixed(2));
    setEditNetHours(Number(log.net_hours ?? 0).toFixed(2));
    setEditOtHours(Number(log.ot_hours ?? 0).toFixed(2));
  };

  const handleCheckInChange = (v: string) => {
    setEditCheckIn(v);
    recalculate(v, editCheckOut);
  };

  const handleCheckOutChange = (v: string) => {
    setEditCheckOut(v);
    recalculate(editCheckIn, v);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-48" />
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Total Hrs</TableHead>
              <TableHead>Rest Hrs</TableHead>
              <TableHead>Net Hrs</TableHead>
              <TableHead>OT Hrs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No records for this date.</TableCell></TableRow>
            ) : (
              logs.map((log) => {
                const staff = staffMap[log.user_id];
                const totalHrs = log.check_out_time
                  ? (new Date(log.check_out_time).getTime() - new Date(log.check_in_time).getTime()) / (1000 * 60 * 60)
                  : 0;
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{staff?.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{staff?.staff_id ?? "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(log.check_in_time).toLocaleTimeString()}</TableCell>
                    <TableCell>{log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell>{totalHrs.toFixed(2)}</TableCell>
                    <TableCell>{Number(log.rest_hours ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{Number(log.net_hours ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{Number(log.ot_hours).toFixed(2)}</TableCell>
                    <TableCell>{log.status}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(log)}>
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

      <Dialog open={!!editLog} onOpenChange={(open) => { if (!open) setEditLog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Attendance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check In</Label>
                <Input type="datetime-local" value={editCheckIn} onChange={(e) => handleCheckInChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Check Out</Label>
                <Input type="datetime-local" value={editCheckOut} onChange={(e) => handleCheckOutChange(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Rest Hours</Label>
                <Input type="number" step="0.01" value={editRestHours} onChange={(e) => setEditRestHours(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Net Hours</Label>
                <Input type="number" step="0.01" value={editNetHours} onChange={(e) => setEditNetHours(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>OT Hours</Label>
                <Input type="number" step="0.01" value={editOtHours} onChange={(e) => setEditOtHours(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Rest = 1hr per 5hrs worked. Net = Total − Rest. OT = Net − 8. You can override these manually.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditLog(null)}>Cancel</Button>
              <Button
                onClick={() => editLog && updateMutation.mutate({
                  id: editLog.id,
                  checkIn: editCheckIn,
                  checkOut: editCheckOut,
                  restHours: parseFloat(editRestHours) || 0,
                  netHours: parseFloat(editNetHours) || 0,
                  otHours: parseFloat(editOtHours) || 0,
                })}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceCorrection;
