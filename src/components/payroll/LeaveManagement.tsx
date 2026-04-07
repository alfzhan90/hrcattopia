import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type StaffProfile = Tables<"staff_profiles">;

const LeaveManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editBalanceOpen, setEditBalanceOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [leaveForm, setLeaveForm] = useState({ staff_profile_id: "", leave_type: "AL" as string, date: "" });
  const [balanceForm, setBalanceForm] = useState({ al_balance: "14", mc_balance: "14" });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-leave"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("*").order("name");
      if (error) throw error;
      return data as StaffProfile[];
    },
  });

  const { data: leaveRecords = [] } = useQuery({
    queryKey: ["leave-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_records")
        .select("*, staff_profiles(name, staff_id)")
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const addLeaveMutation = useMutation({
    mutationFn: async (form: typeof leaveForm) => {
      const { error } = await supabase.from("leave_records").insert({
        staff_profile_id: form.staff_profile_id,
        leave_type: form.leave_type as any,
        date: form.date,
        created_by: user!.id,
      });
      if (error) throw error;

      // Auto-deduct balance for AL/MC
      if (form.leave_type === "AL" || form.leave_type === "MC") {
        const staffProfile = staff.find((s) => s.id === form.staff_profile_id);
        if (staffProfile) {
          const field = form.leave_type === "AL" ? "al_balance" : "mc_balance";
          const newBalance = Math.max(0, (staffProfile[field] as number) - 1);
          await supabase.from("staff_profiles").update(field === "al_balance" ? { al_balance: newBalance } : { mc_balance: newBalance }).eq("id", form.staff_profile_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-records"] });
      queryClient.invalidateQueries({ queryKey: ["staff-leave"] });
      toast({ title: "Leave recorded" });
      setAddOpen(false);
      setLeaveForm({ staff_profile_id: "", leave_type: "AL", date: "" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStaff) return;
      const { error } = await supabase.from("staff_profiles").update({
        al_balance: parseInt(balanceForm.al_balance) || 0,
        mc_balance: parseInt(balanceForm.mc_balance) || 0,
      }).eq("id", selectedStaff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-leave"] });
      toast({ title: "Balance updated" });
      setEditBalanceOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEditBalance = (s: StaffProfile) => {
    setSelectedStaff(s);
    setBalanceForm({ al_balance: String(s.al_balance), mc_balance: String(s.mc_balance) });
    setEditBalanceOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Staff Leave Balances */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Leave Balances</h3>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Record Leave
          </Button>
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>AL Balance</TableHead>
                <TableHead>MC Balance</TableHead>
                <TableHead className="w-16">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.staff_id}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.al_balance} days</TableCell>
                  <TableCell>{s.mc_balance} days</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openEditBalance(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Recent Leave Records */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Leave Records</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveRecords.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No leave records yet.</TableCell></TableRow>
              ) : (
                leaveRecords.map((lr: any) => (
                  <TableRow key={lr.id}>
                    <TableCell>{lr.date}</TableCell>
                    <TableCell>{lr.staff_profiles?.name ?? "Unknown"} ({lr.staff_profiles?.staff_id})</TableCell>
                    <TableCell>{lr.leave_type}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Leave Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Leave</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff</Label>
              <Select value={leaveForm.staff_profile_id} onValueChange={(v) => setLeaveForm({ ...leaveForm, staff_profile_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.staff_id})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveForm.leave_type} onValueChange={(v) => setLeaveForm({ ...leaveForm, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AL">Annual Leave (AL)</SelectItem>
                  <SelectItem value="MC">Medical Leave (MC)</SelectItem>
                  <SelectItem value="UPL">Unpaid Leave (UPL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={leaveForm.date} onChange={(e) => setLeaveForm({ ...leaveForm, date: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={() => addLeaveMutation.mutate(leaveForm)} disabled={addLeaveMutation.isPending || !leaveForm.staff_profile_id || !leaveForm.date}>
                {addLeaveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Balance Dialog */}
      <Dialog open={editBalanceOpen} onOpenChange={setEditBalanceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Leave Balance — {selectedStaff?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>AL Balance (days)</Label>
                <Input type="number" value={balanceForm.al_balance} onChange={(e) => setBalanceForm({ ...balanceForm, al_balance: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>MC Balance (days)</Label>
                <Input type="number" value={balanceForm.mc_balance} onChange={(e) => setBalanceForm({ ...balanceForm, mc_balance: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditBalanceOpen(false)}>Cancel</Button>
              <Button onClick={() => updateBalanceMutation.mutate()} disabled={updateBalanceMutation.isPending}>
                {updateBalanceMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;
