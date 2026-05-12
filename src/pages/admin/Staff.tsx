import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Plus, Smartphone, RotateCcw, Search, Save, Pencil, ArrowRightLeft, Clock, RefreshCw, Loader2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import EmploymentStatusWizard from "@/components/staff/EmploymentStatusWizard";
import RoleTimeline from "@/components/staff/RoleTimeline";
import { isHabitualIncident } from "@/lib/attendance-remarks";
import { AlertOctagon } from "lucide-react";
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

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    email: string;
    ic_number: string;
    kwsp_number: string;
    socso_number: string;
    employment_type: string;
    base_rate: string;
    ot_rate_per_hour: string;
    branch_id: string;
    employment_start_date: string;
    probation_end_date: string;
    probation_confirmed: boolean;
  } | null>(null);
  const [wizardStaff, setWizardStaff] = useState<StaffProfile | null>(null);
  const [timelineStaff, setTimelineStaff] = useState<StaffProfile | null>(null);

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

  // Habitual offender tracking: count Auto-Checkout / Double-Entry incidents in last 30 days
  const { data: incidentMap = {} } = useQuery({
    queryKey: ["habitual-incidents-30d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("user_id, manager_notes")
        .gte("check_in_time", since)
        .not("manager_notes", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (isHabitualIncident(row.manager_notes)) {
          counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
        }
      }
      return counts;
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

  const updateMutation = useMutation({
    mutationFn: async (values: NonNullable<typeof editForm>) => {
      const original = staff.find((s) => s.id === values.id);
      const originalEmail = original?.email || "";

      const { error } = await supabase
        .from("staff_profiles")
        .update({
          name: values.name,
          ic_number: values.ic_number,
          kwsp_number: values.kwsp_number || null,
          socso_number: values.socso_number || null,
          employment_type: values.employment_type as any,
          base_rate: parseFloat(values.base_rate) || 0,
          ot_rate_per_hour: parseFloat(values.ot_rate_per_hour) || 0,
          branch_id: values.branch_id || null,
        })
        .eq("id", values.id);
      if (error) throw error;

      if (values.email && values.email !== originalEmail) {
        const { data, error: fnError } = await supabase.functions.invoke("update-user-email", {
          body: { staff_profile_id: values.id, new_email: values.email },
        });
        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);
        return { emailUpdated: true };
      }
      return { emailUpdated: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      if (result?.emailUpdated) {
        toast({
          title: "✨ Identity Updated",
          description: "Email has been changed instantly. The new email is now active.",
          className: "bg-primary/10 border-primary text-foreground",
        });
      } else {
        toast({ title: "Staff updated", description: "Profile has been saved." });
      }
      setEditDialogOpen(false);
      setEditForm(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async (staffProfileId: string) => {
      const { data, error } = await supabase.functions.invoke("update-user-email", {
        body: { action: "resend_invite", staff_profile_id: staffProfileId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.already_verified) {
        toast({
          title: "✅ Already Verified",
          description: "This user has already confirmed their email address.",
          className: "bg-emerald-500/10 border-emerald-500 text-foreground",
        });
      } else {
        toast({
          title: "✨ Verification Resent",
          description: "A fresh verification link has been sent to the staff member's email address.",
          className: "bg-primary/10 border-primary text-foreground",
        });
      }
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

  const toggleBindingMutation = useMutation({
    mutationFn: async ({ staffId, required }: { staffId: string; required: boolean }) => {
      if (!required) {
        const { error } = await supabase.from("staff_profiles").update({ is_device_binding_required: required, device_id: null }).eq("id", staffId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff_profiles").update({ is_device_binding_required: required }).eq("id", staffId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({ title: "Updated", description: "Device binding requirement updated." });
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

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editForm) updateMutation.mutate(editForm);
  };

  const openEditDialog = (s: StaffProfile) => {
    setEditForm({
      id: s.id,
      name: s.name,
      email: s.email || "",
      ic_number: s.ic_number,
      kwsp_number: s.kwsp_number || "",
      socso_number: s.socso_number || "",
      employment_type: s.employment_type,
      base_rate: String(s.base_rate),
      ot_rate_per_hour: String(s.ot_rate_per_hour),
      branch_id: s.branch_id || "",
    });
    setEditDialogOpen(true);
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

  const formatIcNumber = (value: string) => {
    const raw = value.replace(/[^0-9]/g, "").slice(0, 12);
    return raw.length > 8
      ? `${raw.slice(0, 6)}-${raw.slice(6, 8)}-${raw.slice(8)}`
      : raw.length > 6
      ? `${raw.slice(0, 6)}-${raw.slice(6)}`
      : raw;
  };

  const staffFormFields = (formData: any, setFormData: (v: any) => void, showEmail: boolean, showEditEmail: boolean = false) => (
    <>
      {showEmail && (
        <div className="space-y-2">
          <Label>Email Address</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="staff@example.com"
            required
          />
          <p className="text-xs text-muted-foreground">An invitation email will be sent to this address.</p>
        </div>
      )}
      {showEditEmail && (
        <div className="space-y-2">
          <Label>Email Address</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="staff@example.com"
              className="flex-1"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => resendVerificationMutation.mutate(formData.id)}
                  disabled={resendVerificationMutation.isPending}
                  className="shrink-0 border-primary/30 hover:bg-primary/10 hover:border-primary"
                >
                  {resendVerificationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-primary" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resend verification email</TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground">Admin override — email change takes effect instantly.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>IC Number</Label>
          <Input
            value={formData.ic_number}
            onChange={(e) => setFormData({ ...formData, ic_number: formatIcNumber(e.target.value) })}
            placeholder="######-##-####"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>KWSP Number</Label>
          <Input value={formData.kwsp_number} onChange={(e) => setFormData({ ...formData, kwsp_number: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>SOCSO Number</Label>
          <Input value={formData.socso_number} onChange={(e) => setFormData({ ...formData, socso_number: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Employment Type</Label>
          <Select value={formData.employment_type} onValueChange={(v) => setFormData({ ...formData, employment_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Monthly-FT">Monthly Full-Time</SelectItem>
              <SelectItem value="Hourly-FT">Hourly Full-Time</SelectItem>
              <SelectItem value="Area-Manager">Area Manager</SelectItem>
              <SelectItem value="Freelancer">Freelancer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Branch</Label>
          <Select value={formData.branch_id} onValueChange={(v) => setFormData({ ...formData, branch_id: v })}>
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
          <Label>{formData.employment_type === "Freelancer" ? "Hourly Rate (RM/hour)" : "Base Rate (RM)"}</Label>
          <Input type="number" step="0.01" value={formData.base_rate} onChange={(e) => setFormData({ ...formData, base_rate: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>OT Rate/Hour (RM)</Label>
          <Input type="number" step="0.01" value={formData.ot_rate_per_hour} onChange={(e) => setFormData({ ...formData, ot_rate_per_hour: e.target.value })} />
        </div>
      </div>
    </>
  );

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
              {staffFormFields(form, setForm, true)}
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) { setEditDialogOpen(false); setEditForm(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
          </DialogHeader>
          {editForm && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {staffFormFields(editForm, setEditForm, false, true)}
              <div className="flex items-center gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setEditDialogOpen(false); setEditForm(null); }}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Saving...
                    </span>
                  ) : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
              <TableHead>Email</TableHead>
              <TableHead>IC Number</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Device</TableHead>
              <TableHead className="w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="h-8 w-8 opacity-30" />
                    <p className="font-medium">{search ? "No matching staff found." : "No staff members yet."}</p>
                    {!search && <p className="text-sm">Add your first staff member to get started.</p>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredStaff.map((s) => {
                const incidentCount = incidentMap[s.user_id] ?? 0;
                const isHabitual = incidentCount > 3;
                return (
                <TableRow
                  key={s.id}
                  className={isHabitual ? "bg-warning/10 hover:bg-warning/15" : undefined}
                >
                  <TableCell className="font-mono text-sm">{s.staff_id}</TableCell>
                  <TableCell className="font-medium">
                    <span>{s.name}</span>
                    {s.employment_status === "resigned" || s.employment_status === "terminated" ? (
                      <Badge variant="destructive" className="ml-2 text-[10px]">Exited</Badge>
                    ) : null}
                    {isHabitual ? (
                      <Badge
                        variant="secondary"
                        className="ml-2 text-[10px] gap-1 bg-warning/20 text-warning border-warning/40"
                      >
                        <AlertOctagon className="h-3 w-3" /> Frequent Errors ({incidentCount})
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.email || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.ic_number}</TableCell>
                  <TableCell>{getBranchName(s.branch_id)}</TableCell>
                  <TableCell>
                    <Badge className={
                      s.employment_type === "Monthly-FT" ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" :
                      s.employment_type === "Hourly-FT"  ? "bg-sky-500/10 text-sky-600 border-sky-500/20 hover:bg-sky-500/20" :
                      s.employment_type === "Area-Manager" ? "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20" :
                      "bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20"
                    } variant="outline">
                      {s.employment_type}
                    </Badge>
                  </TableCell>
                   <TableCell>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={s.is_device_binding_required}
                              onCheckedChange={(checked) => toggleBindingMutation.mutate({ staffId: s.id, required: checked })}
                              disabled={toggleBindingMutation.isPending}
                            />
                            <span className="text-xs text-muted-foreground">
                              {s.is_device_binding_required ? "Required" : "Off"}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Require Device Binding</TooltipContent>
                      </Tooltip>
                      {s.is_device_binding_required && s.device_id ? (
                        <Badge variant="outline" className="gap-1">
                          <Smartphone className="h-3 w-3" />
                          Bound
                        </Badge>
                      ) : s.is_device_binding_required ? (
                        <span className="text-xs text-muted-foreground">Not set</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(s)} title="Edit staff">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setWizardStaff(s)} title="Change employment status">
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setTimelineStaff(s)} title="View timeline">
                        <Clock className="h-4 w-4" />
                      </Button>
                      {s.is_device_binding_required && s.device_id && (
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
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Employment Status Wizard */}
      {wizardStaff && (
        <EmploymentStatusWizard
          staff={wizardStaff}
          open={!!wizardStaff}
          onOpenChange={(open) => { if (!open) setWizardStaff(null); }}
        />
      )}

      {/* Role Timeline */}
      {timelineStaff && (
        <RoleTimeline
          staffId={timelineStaff.id}
          staffName={timelineStaff.name}
          open={!!timelineStaff}
          onOpenChange={(open) => { if (!open) setTimelineStaff(null); }}
        />
      )}
    </div>
  );
};

export default Staff;
