import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePersistentForm } from "@/hooks/use-persistent-form";
import { Plus, Smartphone, RotateCcw, Search, Save } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type StaffProfile = Tables<"staff_profiles">;
type Branch = Tables<"branches">;

const defaultStaffForm = {
  name: "",
  email: "",
  ic_number: "",
  kwsp_number: "",
  socso_number: "",
  employment_type: "Monthly-FT",
  base_rate: "0",
  ot_rate_per_hour: "0",
  branch_id: "",
};

const Staff = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { form, setForm, hasDraft, clearDraft } = usePersistentForm("staff_form", defaultStaffForm);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as StaffProfile[];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: {
          email: values.email,
          name: values.name,
          ic_number: values.ic_number,
          kwsp_number: values.kwsp_number || null,
          socso_number: values.socso_number || null,
          employment_type: values.employment_type,
          base_rate: values.base_rate,
          ot_rate_per_hour: values.ot_rate_per_hour,
          branch_id: values.branch_id || null,
        },
      });
      if (error) throw new Error(error.message || "Failed to invite staff");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({ title: "Staff invited", description: "An invitation email has been sent." });
      closeDialog(true);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetDeviceMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase
        .from("staff_profiles")
        .update({ device_id: null })
        .eq("id", staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({ title: "Device reset", description: "Staff member can now register a new device." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const closeDialog = (clearForm = false) => {
    setDialogOpen(false);
    if (clearForm) clearDraft();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const filteredStaff = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.staff_id.toLowerCase().includes(search.toLowerCase()) ||
      s.ic_number.includes(search)
  );

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return "—";
    return branches.find((b) => b.id === branchId)?.name ?? "Unknown";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground">Manage staff profiles, IC numbers, KWSP, SOCSO, and device bindings.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Staff</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="staff@example.com"
                  required
                />
                <p className="text-xs text-muted-foreground">An invitation email will be sent to this address.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>IC Number</Label>
                  <Input
                    value={form.ic_number}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 12);
                      const formatted = raw.length > 8
                        ? `${raw.slice(0, 6)}-${raw.slice(6, 8)}-${raw.slice(8)}`
                        : raw.length > 6
                        ? `${raw.slice(0, 6)}-${raw.slice(6)}`
                        : raw;
                      setForm({ ...form, ic_number: formatted });
                    }}
                    placeholder="######-##-####"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>KWSP Number</Label>
                  <Input value={form.kwsp_number} onChange={(e) => setForm({ ...form, kwsp_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>SOCSO Number</Label>
                  <Input value={form.socso_number} onChange={(e) => setForm({ ...form, socso_number: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employment Type</Label>
                  <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly-FT">Monthly Full-Time</SelectItem>
                      <SelectItem value="Hourly-FT">Hourly Full-Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base Rate (RM)</Label>
                  <Input type="number" step="0.01" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>OT Rate/Hour (RM)</Label>
                  <Input type="number" step="0.01" value={form.ot_rate_per_hour} onChange={(e) => setForm({ ...form, ot_rate_per_hour: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                {hasDraft && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mr-auto">
                    <Save className="h-3 w-3" />
                    Draft saved
                  </span>
                )}
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Sending Invite..." : "Invite & Create Staff"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, ID, or IC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>IC Number</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Device</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : filteredStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {search ? "No matching staff found." : "No staff members yet."}
                </TableCell>
              </TableRow>
            ) : (
              filteredStaff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.staff_id}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.ic_number}</TableCell>
                  <TableCell>{getBranchName(s.branch_id)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{s.employment_type}</Badge>
                  </TableCell>
                  <TableCell>
                    {s.device_id ? (
                      <Badge variant="outline" className="gap-1">
                        <Smartphone className="h-3 w-3" />
                        Bound
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.device_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resetDeviceMutation.mutate(s.id)}
                        disabled={resetDeviceMutation.isPending}
                        title="Reset device binding"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Staff;
