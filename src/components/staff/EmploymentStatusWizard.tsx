import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowRightLeft, UserX, UserCheck, AlertTriangle } from "lucide-react";
import { format, addDays } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type StaffProfile = Tables<"staff_profiles">;

interface Props {
  staff: StaffProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = "choose" | "convert" | "resign" | "reactivate";

const ROLE_OPTIONS = [
  { value: "Monthly-FT", label: "Monthly Full-Time" },
  { value: "Hourly-FT", label: "Hourly Full-Time" },
  { value: "Area-Manager", label: "Area Manager" },
  { value: "Freelancer", label: "Freelancer" },
];

export default function EmploymentStatusWizard({ staff, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState<WizardStep>("choose");

  // Convert form
  const [newRole, setNewRole] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newRate, setNewRate] = useState("");
  const [convertReason, setConvertReason] = useState("");

  // Resign form
  const [lastWorkingDay, setLastWorkingDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [exitReason, setExitReason] = useState("");
  const [encashmentDays, setEncashmentDays] = useState("0");
  const [exitType, setExitType] = useState<"resigned" | "terminated">("resigned");

  // Reactivate form
  const [reactivateRole, setReactivateRole] = useState(staff.employment_type);
  const [reactivateRate, setReactivateRate] = useState(String(staff.base_rate));
  const [reactivateReason, setReactivateReason] = useState("");

  const isInactive = (staff as any).employment_status === "inactive" ||
    (staff as any).employment_status === "resigned" ||
    (staff as any).employment_status === "terminated";

  const resetAndClose = () => {
    setStep("choose");
    onOpenChange(false);
  };

  const convertMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Log role history
      const { error: histErr } = await supabase.from("role_history" as any).insert({
        staff_profile_id: staff.id,
        old_role: staff.employment_type,
        new_role: newRole,
        old_rate: staff.base_rate,
        new_rate: parseFloat(newRate) || 0,
        effective_date: effectiveDate,
        reason: convertReason || null,
        action_type: "conversion",
        changed_by: user.id,
      });
      if (histErr) throw histErr;

      // Update profile
      const { error } = await supabase
        .from("staff_profiles")
        .update({
          employment_type: newRole as any,
          base_rate: parseFloat(newRate) || staff.base_rate,
        })
        .eq("id", staff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["freelancers"] });
      toast({
        title: "✨ Role Converted",
        description: `${staff.name} is now ${newRole}. Effective ${effectiveDate}.`,
        className: "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))] text-foreground",
      });
      resetAndClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resignMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const revokeDate = format(addDays(new Date(lastWorkingDay), 30), "yyyy-MM-dd");

      const { error: histErr } = await supabase.from("role_history" as any).insert({
        staff_profile_id: staff.id,
        old_role: staff.employment_type,
        new_role: exitType,
        old_rate: staff.base_rate,
        new_rate: 0,
        effective_date: lastWorkingDay,
        reason: exitReason || null,
        action_type: exitType === "resigned" ? "resignation" : "termination",
        changed_by: user.id,
      });
      if (histErr) throw histErr;

      const { error } = await supabase
        .from("staff_profiles")
        .update({
          employment_status: exitType,
          exit_date: lastWorkingDay,
          exit_reason: exitReason || null,
          leave_encashment_days: parseInt(encashmentDays) || 0,
          access_revoke_date: revokeDate,
        } as any)
        .eq("id", staff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["freelancers"] });
      toast({
        title: "Staff Exit Processed",
        description: `${staff.name} marked as ${exitType}. Access revokes 30 days after last day.`,
      });
      resetAndClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: histErr } = await supabase.from("role_history" as any).insert({
        staff_profile_id: staff.id,
        old_role: (staff as any).employment_status || staff.employment_type,
        new_role: reactivateRole,
        old_rate: 0,
        new_rate: parseFloat(reactivateRate) || 0,
        effective_date: format(new Date(), "yyyy-MM-dd"),
        reason: reactivateReason || null,
        action_type: "reactivation",
        changed_by: user.id,
      });
      if (histErr) throw histErr;

      const { error } = await supabase
        .from("staff_profiles")
        .update({
          employment_type: reactivateRole as any,
          base_rate: parseFloat(reactivateRate) || 0,
          employment_status: "active",
          exit_date: null,
          exit_reason: null,
          access_revoke_date: null,
          leave_encashment_days: 0,
        } as any)
        .eq("id", staff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["freelancers"] });
      toast({
        title: "✨ Staff Re-activated",
        description: `${staff.name} has been re-activated as ${reactivateRole}.`,
        className: "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))] text-foreground",
      });
      resetAndClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change Employment Status — {staff.name}</DialogTitle>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Current: <Badge variant="secondary">{staff.employment_type}</Badge>
              {isInactive && <Badge variant="destructive" className="ml-2">{(staff as any).employment_status}</Badge>}
            </p>
            <div className="grid gap-3">
              {!isInactive && (
                <>
                  <Button variant="outline" className="justify-start gap-3 h-auto py-3" onClick={() => setStep("convert")}>
                    <ArrowRightLeft className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">Convert Role</div>
                      <div className="text-xs text-muted-foreground">Switch between Staff ↔ Freelancer / change employment type</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start gap-3 h-auto py-3" onClick={() => setStep("resign")}>
                    <UserX className="h-5 w-5 text-destructive" />
                    <div className="text-left">
                      <div className="font-medium">Resign / Terminate</div>
                      <div className="text-xs text-muted-foreground">Process exit with final pay calculation</div>
                    </div>
                  </Button>
                </>
              )}
              {isInactive && (
                <Button variant="outline" className="justify-start gap-3 h-auto py-3" onClick={() => setStep("reactivate")}>
                  <UserCheck className="h-5 w-5 text-green-500" />
                  <div className="text-left">
                    <div className="font-medium">Re-activate</div>
                    <div className="text-xs text-muted-foreground">Bring back this staff member with a new or existing role</div>
                  </div>
                </Button>
              )}
            </div>
          </div>
        )}

        {step === "convert" && (
          <form onSubmit={(e) => { e.preventDefault(); convertMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue placeholder="Select new role" /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.filter((r) => r.value !== staff.employment_type).map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>New Rate (RM)</Label>
                <Input type="number" step="0.01" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder={String(staff.base_rate)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea value={convertReason} onChange={(e) => setConvertReason(e.target.value)} placeholder="e.g. Performance upgrade, contract change..." />
            </div>
            <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[hsl(var(--gold))]" />
              <span>Mid-cycle conversions will auto-prorate. The current month's payroll will split between old and new rate.</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("choose")}>Back</Button>
              <Button type="submit" disabled={!newRole || convertMutation.isPending}>
                {convertMutation.isPending ? "Processing..." : "Convert Role"}
              </Button>
            </div>
          </form>
        )}

        {step === "resign" && (
          <form onSubmit={(e) => { e.preventDefault(); resignMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Exit Type</Label>
              <Select value={exitType} onValueChange={(v) => setExitType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resigned">Resignation</SelectItem>
                  <SelectItem value="terminated">Termination</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Last Working Day</Label>
                <Input type="date" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} required />
              </div>
              {staff.employment_type !== "Freelancer" && (
                <div className="space-y-2">
                  <Label>Leave Encashment Days</Label>
                  <Input type="number" min="0" value={encashmentDays} onChange={(e) => setEncashmentDays(e.target.value)} />
                  <p className="text-xs text-muted-foreground">AL balance: {staff.al_balance} days</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Reason for Leaving</Label>
              <Textarea value={exitReason} onChange={(e) => setExitReason(e.target.value)} placeholder="e.g. Personal reasons, end of contract..." required />
            </div>
            <div className="p-3 bg-destructive/10 rounded-lg text-xs text-destructive flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Clock-in will be disabled after the last working day. Login access will be revoked 30 days after exit for document retrieval.</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("choose")}>Back</Button>
              <Button type="submit" variant="destructive" disabled={resignMutation.isPending}>
                {resignMutation.isPending ? "Processing..." : `Confirm ${exitType === "resigned" ? "Resignation" : "Termination"}`}
              </Button>
            </div>
          </form>
        )}

        {step === "reactivate" && (
          <form onSubmit={(e) => { e.preventDefault(); reactivateMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={reactivateRole} onValueChange={setReactivateRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Base Rate (RM)</Label>
              <Input type="number" step="0.01" value={reactivateRate} onChange={(e) => setReactivateRate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea value={reactivateReason} onChange={(e) => setReactivateReason(e.target.value)} placeholder="e.g. Rehired, contract renewal..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("choose")}>Back</Button>
              <Button type="submit" disabled={reactivateMutation.isPending}>
                {reactivateMutation.isPending ? "Processing..." : "Re-activate"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
