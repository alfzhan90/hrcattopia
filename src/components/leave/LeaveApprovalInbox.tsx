import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, FileText, InboxIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const LeaveApprovalInbox = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingLeaves = [], isLoading } = useQuery({
    queryKey: ["pending-leave-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_records")
        .select("*, staff_profiles!inner(name, staff_id, al_balance, mc_balance, id, employment_type)")
        .eq("status", "pending" as any)
        .neq("staff_profiles.employment_type", "Freelancer")
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: allLeaves = [] } = useQuery({
    queryKey: ["all-leave-requests-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_records")
        .select("*, staff_profiles(name, staff_id)")
        .neq("status", "pending" as any)
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (leave: any) => {
      // For AL: count weekdays in this group (same staff + same end_date + AL + pending) and check balance
      if (leave.leave_type === "AL" && leave.staff_profiles) {
        const { data: groupRows } = await supabase
          .from("leave_records")
          .select("date")
          .eq("staff_profile_id", leave.staff_profiles.id)
          .eq("leave_type", "AL" as any)
          .eq("status", "pending" as any)
          .eq("end_date", leave.end_date ?? leave.date);
        const weekdays = (groupRows ?? []).filter((r: any) => {
          const d = new Date(r.date + "T00:00:00").getDay();
          return d !== 0 && d !== 6;
        }).length || 1;
        const balance = leave.staff_profiles.al_balance as number;
        if (weekdays > balance) {
          throw new Error(`Insufficient AL balance: needs ${weekdays} day(s), has ${balance}.`);
        }
        const { error: balErr } = await supabase
          .from("staff_profiles")
          .update({ al_balance: Math.max(0, balance - weekdays) })
          .eq("id", leave.staff_profiles.id);
        if (balErr) throw balErr;
      } else if (leave.leave_type === "MC" && leave.staff_profiles) {
        const balance = leave.staff_profiles.mc_balance as number;
        await supabase
          .from("staff_profiles")
          .update({ mc_balance: Math.max(0, balance - 1) })
          .eq("id", leave.staff_profiles.id);
      }

      // Update all matching pending rows in this request group to approved
      const groupFilter = supabase
        .from("leave_records")
        .update({
          status: "approved" as any,
          approved_by: user!.id,
          approved_at: new Date().toISOString(),
        })
        .eq("staff_profile_id", leave.staff_profiles.id)
        .eq("leave_type", leave.leave_type)
        .eq("status", "pending" as any)
        .eq("end_date", leave.end_date ?? leave.date);
      const { error } = await groupFilter;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-leave-requests-recent"] });
      queryClient.invalidateQueries({ queryKey: ["staff-leave"] });
      toast({ title: "Leave approved", description: "Balance has been auto-deducted." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (leaveId: string) => {
      const { error } = await supabase
        .from("leave_records")
        .update({
          status: "rejected" as any,
          approved_by: user!.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", leaveId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-leave-requests-recent"] });
      toast({ title: "Leave rejected" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const leaveTypeLabel = (t: string) => {
    const map: Record<string, string> = { AL: "Annual Leave", MC: "Medical Leave", UPL: "Unpaid Leave", EL: "Emergency Leave" };
    return map[t] || t;
  };

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <div>
        <h3 className="text-lg font-semibold mb-3">
          Pending Requests
          {pendingLeaves.length > 0 && (
            <Badge variant="destructive" className="ml-2">{pendingLeaves.length}</Badge>
          )}
        </h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>MC</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : pendingLeaves.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <InboxIcon className="h-7 w-7 opacity-30" />
                    <p className="font-medium">No pending requests.</p>
                  </div>
                </TableCell></TableRow>
              ) : (
                pendingLeaves.map((lr: any) => (
                  <TableRow key={lr.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{lr.staff_profiles?.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{lr.staff_profiles?.staff_id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{lr.date}</TableCell>
                    <TableCell className="text-sm">{leaveTypeLabel(lr.leave_type)}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{lr.reason || "—"}</TableCell>
                    <TableCell>
                      {lr.mc_file_url ? (
                        <Button asChild size="sm" variant="outline" className="h-8">
                          <a href={lr.mc_file_url} target="_blank" rel="noopener noreferrer">
                            <FileText className="h-3.5 w-3.5 mr-1" /> View Document
                          </a>
                        </Button>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {lr.leave_type === "AL" && `AL: ${lr.staff_profiles?.al_balance}`}
                      {lr.leave_type === "MC" && `MC: ${lr.staff_profiles?.mc_balance}`}
                      {(lr.leave_type === "UPL" || lr.leave_type === "EL") && "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-600"
                          onClick={() => approveMutation.mutate(lr)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => rejectMutation.mutate(lr.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Recent Processed Requests */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Decisions</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allLeaves.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No records.</TableCell></TableRow>
              ) : (
                allLeaves.map((lr: any) => (
                  <TableRow key={lr.id}>
                    <TableCell className="text-sm">{lr.staff_profiles?.name} ({lr.staff_profiles?.staff_id})</TableCell>
                    <TableCell className="text-sm">{lr.date}</TableCell>
                    <TableCell className="text-sm">{leaveTypeLabel(lr.leave_type)}</TableCell>
                    <TableCell>
                      <Badge variant={lr.status === "approved" ? "default" : "destructive"}>{lr.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default LeaveApprovalInbox;
