import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Calendar } from "lucide-react";
import { format } from "date-fns";

const leaveLabel: Record<string, string> = { AL: "Annual", MC: "Medical", UPL: "Unpaid", EL: "Emergency" };
const statusVariant = (s: string) => s === "approved" ? "default" as const : s === "rejected" ? "destructive" as const : "secondary" as const;

const StaffLeave = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "AL", start_date: "", end_date: "", reason: "" });
  const [mcFile, setMcFile] = useState<File | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Redirect freelancers away from leave page
  if (profile?.employment_type === "Freelancer") {
    return <Navigate to="/staff/dashboard" replace />;
  }

  const { data: leaves = [] } = useQuery({
    queryKey: ["my-leave-requests", profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from("leave_records").select("*").eq("staff_profile_id", profile!.id).order("date", { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!profile,
  });

  // Realtime updates so staff sees Approved/Rejected instantly
  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase
      .channel(`leave-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_records", filter: `staff_profile_id=eq.${profile.id}` },
        () => qc.invalidateQueries({ queryKey: ["my-leave-requests", profile.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id, qc]);

  const { data: holidays = [] } = useQuery({
    queryKey: ["public-holidays"],
    queryFn: async () => {
      const { data } = await supabase.from("public_holidays").select("*").order("date");
      return data ?? [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Profile not found");
      if (!form.start_date) throw new Error("Pick a start date");

      // 3-day notice for AL
      if (form.leave_type === "AL") {
        const start = new Date(form.start_date + "T00:00:00");
        const minStart = new Date();
        minStart.setHours(0, 0, 0, 0);
        minStart.setDate(minStart.getDate() + 3);
        if (start < minStart) {
          throw new Error("⚠️ AL must be applied 3 days in advance. Use EL for emergencies.");
        }
      }

      // MC requires a file
      if (form.leave_type === "MC" && !mcFile) {
        throw new Error("Please upload your MC document.");
      }

      let mcFileUrl: string | null = null;
      if (mcFile && form.leave_type === "MC") {
        const ext = mcFile.name.split(".").pop();
        const path = `${user!.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("mc-uploads").upload(path, mcFile);
        if (error) throw error;
        mcFileUrl = supabase.storage.from("mc-uploads").getPublicUrl(path).data.publicUrl;
      }
      const start = new Date(form.start_date);
      const end = form.end_date ? new Date(form.end_date) : start;
      const records = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        records.push({
          staff_profile_id: profile.id, leave_type: form.leave_type as any,
          date: d.toISOString().split("T")[0], end_date: form.end_date || form.start_date,
          reason: form.reason || null, mc_file_url: mcFileUrl, status: "pending" as any, created_by: user!.id,
        });
      }
      const { error } = await supabase.from("leave_records").insert(records);
      if (error) throw error;

      // Notify admin via Telegram (fire-and-forget)
      supabase.functions.invoke("notify-leave-request", {
        body: {
          staff_name: profile.name,
          leave_type: form.leave_type,
          start_date: form.start_date,
          end_date: form.end_date || form.start_date,
          reason: form.reason || null,
        },
      }).catch((e) => console.warn("notify-leave-request failed", e));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-leave-requests"] });
      toast({ title: "Leave request submitted" });
      setOpen(false);
      setForm({ leave_type: "AL", start_date: "", end_date: "", reason: "" });
      setMcFile(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Leave</h1>
        {profile && (
          <div className="flex gap-3 text-xs">
            <Badge variant="outline">AL: {profile.al_balance}</Badge>
            <Badge variant="outline">MC: {profile.mc_balance}</Badge>
          </div>
        )}
      </div>

      {/* Leave list */}
      <div className="space-y-2">
        {leaves.length === 0 ? (
          <Card className="rounded-xl"><CardContent className="p-6 text-center text-sm text-muted-foreground">No leave requests yet.</CardContent></Card>
        ) : leaves.map((lr: any) => (
          <Card key={lr.id} className="rounded-xl">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{leaveLabel[lr.leave_type] || lr.leave_type}</p>
                <p className="text-xs text-muted-foreground">{lr.date}{lr.end_date && lr.end_date !== lr.date ? ` → ${lr.end_date}` : ""}</p>
                {lr.reason && <p className="text-xs text-muted-foreground truncate mt-0.5">{lr.reason}</p>}
              </div>
              <Badge variant={statusVariant(lr.status)} className="shrink-0 capitalize">{lr.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming holidays */}
      {holidays.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1"><Calendar className="h-4 w-4" /> Public Holidays</h2>
          <div className="space-y-1">
            {holidays.filter((h: any) => h.date >= format(new Date(), "yyyy-MM-dd")).slice(0, 5).map((h: any) => (
              <div key={h.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-background border">
                <span>{h.name}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(h.date), "d MMM")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Request Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] rounded-2xl">
          <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                <SelectTrigger className="w-full h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AL">Annual Leave</SelectItem>
                  <SelectItem value="MC">Medical Leave</SelectItem>
                  <SelectItem value="UPL">Unpaid Leave</SelectItem>
                  <SelectItem value="EL">Emergency Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="date"
                  className="h-12 rounded-xl"
                  value={form.start_date}
                  min={form.leave_type === "AL"
                    ? new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0]
                    : undefined}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input type="date" className="h-12 rounded-xl" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            {form.leave_type === "AL" && (
              <p className="text-xs text-muted-foreground">⚠️ AL must be applied at least 3 days in advance. Use EL for emergencies.</p>
            )}
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea placeholder="Reason..." className="rounded-xl min-h-[80px]" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            {form.leave_type === "MC" && (
              <div className="space-y-2">
                <Label>MC Document</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*,.pdf" className="h-12 rounded-xl" onChange={(e) => setMcFile(e.target.files?.[0] ?? null)} />
                  {mcFile && <Upload className="h-4 w-4 text-green-600 shrink-0" />}
                </div>
              </div>
            )}
            <Button className="w-full h-12 rounded-xl" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !form.start_date}>
              {submitMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffLeave;
