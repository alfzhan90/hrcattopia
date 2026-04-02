import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";
import { format } from "date-fns";

const AttendanceCorrection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [editLog, setEditLog] = useState<any>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");

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

  const updateMutation = useMutation({
    mutationFn: async ({ id, checkIn, checkOut }: { id: string; checkIn: string; checkOut: string }) => {
      const checkInDate = new Date(checkIn);
      const updates: any = { check_in_time: checkInDate.toISOString() };

      if (checkOut) {
        const checkOutDate = new Date(checkOut);
        const durationHours = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60);
        updates.check_out_time = checkOutDate.toISOString();
        updates.regular_hours = Math.round(Math.min(durationHours, 8) * 100) / 100;
        updates.ot_hours = Math.round(Math.max(durationHours - 8, 0) * 100) / 100;
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
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-48" />
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Regular Hrs</TableHead>
              <TableHead>OT Hrs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No records for this date.</TableCell></TableRow>
            ) : (
              logs.map((log) => {
                const staff = staffMap[log.user_id];
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
                    <TableCell>{Number(log.regular_hours).toFixed(2)}</TableCell>
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
            <div className="space-y-2">
              <Label>Check In</Label>
              <Input type="datetime-local" value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Check Out</Label>
              <Input type="datetime-local" value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditLog(null)}>Cancel</Button>
              <Button
                onClick={() => editLog && updateMutation.mutate({ id: editLog.id, checkIn: editCheckIn, checkOut: editCheckOut })}
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
