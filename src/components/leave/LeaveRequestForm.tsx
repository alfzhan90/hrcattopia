import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, FileText } from "lucide-react";

const LeaveRequestForm = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    leave_type: "AL" as string,
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [mcFile, setMcFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile-leave", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: myLeaves = [] } = useQuery({
    queryKey: ["my-leave-requests", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_records")
        .select("*")
        .eq("staff_profile_id", profile!.id)
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Profile not found");
      setUploading(true);

      let mcFileUrl: string | null = null;

      // Upload MC file if present
      if (mcFile && form.leave_type === "MC") {
        const ext = mcFile.name.split(".").pop();
        const filePath = `${user!.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("mc-uploads")
          .upload(filePath, mcFile);
        if (uploadError) throw new Error(`MC upload failed: ${uploadError.message}`);
        
        const { data: urlData } = supabase.storage
          .from("mc-uploads")
          .getPublicUrl(filePath);
        mcFileUrl = urlData.publicUrl;
      }

      // Create leave records for each day in the range
      const startDate = new Date(form.start_date);
      const endDate = form.end_date ? new Date(form.end_date) : startDate;
      const records = [];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        records.push({
          staff_profile_id: profile.id,
          leave_type: form.leave_type as any,
          date: d.toISOString().split("T")[0],
          end_date: form.end_date || form.start_date,
          reason: form.reason || null,
          mc_file_url: mcFileUrl,
          status: "pending" as any,
          created_by: user!.id,
        });
      }

      const { error } = await supabase.from("leave_records").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
      toast({ title: "Leave request submitted", description: "Waiting for admin approval." });
      setOpen(false);
      setForm({ leave_type: "AL", start_date: "", end_date: "", reason: "" });
      setMcFile(null);
      setUploading(false);
    },
    onError: (err: any) => {
      setUploading(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusColor = (status: string) => {
    if (status === "approved") return "default";
    if (status === "rejected") return "destructive";
    return "secondary";
  };

  const leaveTypeLabel = (t: string) => {
    const map: Record<string, string> = { AL: "Annual Leave", MC: "Medical Leave", UPL: "Unpaid Leave", EL: "Emergency Leave" };
    return map[t] || t;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">My Leave Requests</h3>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Request Leave
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>MC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {myLeaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No leave requests yet.
                </TableCell>
              </TableRow>
            ) : (
              myLeaves.map((lr: any) => (
                <TableRow key={lr.id}>
                  <TableCell className="text-sm">{lr.date}</TableCell>
                  <TableCell className="text-sm">{leaveTypeLabel(lr.leave_type)}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{lr.reason || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(lr.status)}>{lr.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {lr.mc_file_url ? (
                      <a href={lr.mc_file_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 text-primary" />
                      </a>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Request Leave Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AL">Annual Leave (AL)</SelectItem>
                  <SelectItem value="MC">Medical Leave (MC)</SelectItem>
                  <SelectItem value="UPL">Unpaid Leave (UPL)</SelectItem>
                  <SelectItem value="EL">Emergency Leave (EL)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Reason for leave..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            {form.leave_type === "MC" && (
              <div className="space-y-2">
                <Label>MC Document (image/PDF)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setMcFile(e.target.files?.[0] ?? null)}
                  />
                  {mcFile && <Upload className="h-4 w-4 text-green-600" />}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !form.start_date}
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveRequestForm;
