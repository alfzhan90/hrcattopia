import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, LogOut, Calendar, Clock } from "lucide-react";
import LeaveRequestForm from "@/components/leave/LeaveRequestForm";
import { generatePayslipPdf } from "@/lib/payslip-pdf";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type StaffProfile = Tables<"staff_profiles">;

const StaffDashboard = () => {
  const { user, signOut } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["my-profile-dashboard", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as StaffProfile | null;
    },
    enabled: !!user,
  });

  const { data: branch } = useQuery({
    queryKey: ["my-branch-dashboard", profile?.branch_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").eq("id", profile!.branch_id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.branch_id,
  });

  const { data: attendanceLogs = [] } = useQuery({
    queryKey: ["my-attendance-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("check_in_time", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ["my-payslips", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("staff_profile_id", profile!.id)
        .eq("status", "released")
        .order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const downloadPayslip = async (run: any) => {
    if (!profile) return;
    const blob = await generatePayslipPdf({
      companyName: "CATTOPIA SDN BHD",
      month: format(new Date(run.month), "MMMM yyyy"),
      staffId: profile.staff_id,
      staffName: profile.name,
      icNumber: profile.ic_number,
      kwspNumber: profile.kwsp_number ?? "",
      socsoNumber: profile.socso_number ?? "",
      branchName: branch?.name ?? "—",
      employmentType: profile.employment_type,
      basicPay: Number(run.basic_pay),
      otPay: Number(run.ot_pay),
      allowance: Number(run.allowance),
      commission: Number(run.commission),
      holidayPay: Number(run.holiday_pay),
      grossPay: Number(run.gross_pay),
      epfEmployee: Number(run.epf_employee),
      epfEmployer: Number(run.epf_employer),
      socsoEmployee: Number(run.socso_employee),
      socsoEmployer: Number(run.socso_employer),
      eisEmployee: Number(run.eis_employee),
      eisEmployer: Number(run.eis_employer),
      pcb: Number(run.pcb),
      uplDeduction: Number(run.upl_deduction),
      netPay: Number(run.net_pay),
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Payslip_${profile.staff_id}_${format(new Date(run.month), "yyyy-MM")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/50">
      <header className="border-b bg-background px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Staff Portal</h1>
          <p className="text-sm text-muted-foreground">{profile.name} • {profile.staff_id}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-1" /> Sign Out
        </Button>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Leave Balance Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Annual Leave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{profile.al_balance}</p>
              <p className="text-xs text-muted-foreground">days remaining</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Medical Leave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{profile.mc_balance}</p>
              <p className="text-xs text-muted-foreground">days remaining</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="leave">
          <TabsList>
            <TabsTrigger value="leave">Leave</TabsTrigger>
            <TabsTrigger value="payslips">Payslips</TabsTrigger>
            <TabsTrigger value="attendance">Attendance History</TabsTrigger>
          </TabsList>

          <TabsContent value="leave" className="mt-4">
            <LeaveRequestForm />
          </TabsContent>

          <TabsContent value="payslips" className="mt-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Gross Pay</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead className="w-20">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No payslips released yet.</TableCell>
                    </TableRow>
                  ) : (
                    payslips.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{format(new Date(p.month), "MMMM yyyy")}</TableCell>
                        <TableCell>RM {Number(p.gross_pay).toFixed(2)}</TableCell>
                        <TableCell className="font-bold">RM {Number(p.net_pay).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => downloadPayslip(p)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="mt-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Regular Hrs</TableHead>
                    <TableHead>OT Hrs</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No attendance records.</TableCell>
                    </TableRow>
                  ) : (
                    attendanceLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell>{format(new Date(log.check_in_time), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{new Date(log.check_in_time).toLocaleTimeString()}</TableCell>
                        <TableCell>{log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString() : "—"}</TableCell>
                        <TableCell>{Number(log.regular_hours).toFixed(2)}</TableCell>
                        <TableCell>{Number(log.ot_hours).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={log.status === "on_time" ? "default" : "destructive"}>
                            {log.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StaffDashboard;
