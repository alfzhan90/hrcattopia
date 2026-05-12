import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  deducted: "outline",
};

const SalaryAdvances = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ staff_profile_id: "", amount: "0", reason: "", deduct_month: "" });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("id, name, staff_id").order("name");
      return data ?? [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["salary-advances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_advances")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("salary_advances").insert({
        staff_profile_id: form.staff_profile_id,
        requested_by: user!.id,
        amount: parseFloat(form.amount) || 0,
        reason: form.reason || null,
        deduct_month: form.deduct_month ? `${form.deduct_month}-01` : null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salary-advances"] });
      toast({ title: "Advance request created" });
      setOpen(false);
      setForm({ staff_profile_id: "", amount: "0", reason: "", deduct_month: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const decisionMut = useMutation({
    mutationFn: async (vars: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("salary_advances")
        .update({
          status: vars.status,
          approved_by: user!.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["salary-advances"] });
      toast({ title: `Advance ${vars.status}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const staffLabel = (id: string) => {
    const s = staff.find((x) => x.id === id);
    return s ? `${s.staff_id} — ${s.name}` : "—";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Salary Advances</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Advance</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Salary Advance</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Staff</Label>
                <Select value={form.staff_profile_id} onValueChange={(v) => setForm({ ...form, staff_profile_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.staff_id} — {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (RM)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Deduct in Month</Label>
                <Input type="month" value={form.deduct_month} onChange={(e) => setForm({ ...form, deduct_month: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate()} disabled={!form.staff_profile_id || createMut.isPending}>
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Deduct Month</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No advances yet.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{staffLabel(r.staff_profile_id)}</TableCell>
                <TableCell className="text-right tabular-nums font-mono">RM {Number(r.amount).toFixed(2)}</TableCell>
                <TableCell className="text-sm">{r.deduct_month ? format(new Date(r.deduct_month), "MMM yyyy") : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">{r.reason || "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
                </TableCell>
                <TableCell>
                  {r.status === "pending" ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => decisionMut.mutate({ id: r.id, status: "approved" })}>
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => decisionMut.mutate({ id: r.id, status: "rejected" })}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {r.approved_at ? format(new Date(r.approved_at), "dd MMM") : ""}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default SalaryAdvances;
