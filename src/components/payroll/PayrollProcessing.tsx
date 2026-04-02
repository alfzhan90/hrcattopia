import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calculator, CheckCircle, FileText } from "lucide-react";
import { calcEpfEmployee, calcEpfEmployer, calcSocso, calcEis, calcUplDeduction, calcHourlyRate, calcRestHours, calcNetHours, calcDailyOt } from "@/lib/payroll";
import { generatePayslipPdf } from "@/lib/payslip-pdf";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval, isSameWeek } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type StaffProfile = Tables<"staff_profiles">;

const PayrollProcessing = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [editOpen, setEditOpen] = useState(false);
  const [editRun, setEditRun] = useState<any>(null);

  const monthDate = `${selectedMonth}-01`;

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-payroll"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("*").order("name");
      if (error) throw error;
      return data as StaffProfile[];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-payroll"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: payrollRuns = [], isLoading } = useQuery({
    queryKey: ["payroll-runs", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("month", monthDate)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays-payroll", selectedMonth],
    queryFn: async () => {
      const start = startOfMonth(new Date(monthDate));
      const end = endOfMonth(new Date(monthDate));
      const { data, error } = await supabase
        .from("public_holidays")
        .select("*")
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const start = startOfMonth(new Date(monthDate));
      const end = endOfMonth(new Date(monthDate));

      // Get attendance logs for the month
      const { data: allLogs, error: logError } = await supabase
        .from("attendance_logs")
        .select("*")
        .gte("check_in_time", format(start, "yyyy-MM-dd"))
        .lte("check_in_time", format(end, "yyyy-MM-dd"));
      if (logError) throw logError;

      // Get leave records
      const { data: leaveRecords, error: leaveError } = await supabase
        .from("leave_records")
        .select("*")
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"));
      if (leaveError) throw leaveError;

      const holidayDates = new Map(holidays.map((h: any) => [h.date, h.multiplier]));

      const runs = [];

      for (const s of staff) {
        const staffLogs = (allLogs ?? []).filter((l) => l.user_id === s.user_id);
        const staffLeave = (leaveRecords ?? []).filter((lr: any) => lr.staff_profile_id === s.id);
        const uplDays = staffLeave.filter((lr: any) => lr.leave_type === "UPL").length;

        // Calculate hours
        let totalRegular = 0;
        let totalOt = 0;
        let holidayHours = 0;

        staffLogs.forEach((log) => {
          const logDate = format(new Date(log.check_in_time), "yyyy-MM-dd");
          const multiplier = holidayDates.get(logDate);
          if (multiplier) {
            holidayHours += (Number(log.regular_hours) + Number(log.ot_hours)) * (multiplier - 1);
          }
          totalRegular += Number(log.regular_hours);
          totalOt += Number(log.ot_hours);
        });

        const basicPay = Number(s.base_rate);
        const otPay = Math.round(totalOt * Number(s.ot_rate_per_hour) * 100) / 100;
        const holidayPay = Math.round(holidayHours * Number(s.ot_rate_per_hour) * 100) / 100;
        const uplDeduction = calcUplDeduction(basicPay, uplDays);
        const grossPay = Math.round((basicPay + otPay + holidayPay - uplDeduction) * 100) / 100;

        const epfEmployee = calcEpfEmployee(grossPay);
        const epfEmployer = calcEpfEmployer(grossPay);
        const socso = calcSocso(grossPay);
        const eis = calcEis(grossPay);
        const netPay = Math.round((grossPay - epfEmployee - socso.employee - eis.employee) * 100) / 100;

        runs.push({
          month: monthDate,
          staff_profile_id: s.id,
          basic_pay: basicPay,
          ot_pay: otPay,
          allowance: 0,
          commission: 0,
          holiday_pay: holidayPay,
          gross_pay: grossPay,
          epf_employee: epfEmployee,
          epf_employer: epfEmployer,
          socso_employee: socso.employee,
          socso_employer: socso.employer,
          eis_employee: eis.employee,
          eis_employer: eis.employer,
          pcb: 0,
          upl_deduction: uplDeduction,
          net_pay: netPay,
          status: "draft" as const,
        });
      }

      // Upsert
      for (const run of runs) {
        const { data: existing } = await supabase
          .from("payroll_runs")
          .select("id")
          .eq("month", monthDate)
          .eq("staff_profile_id", run.staff_profile_id)
          .maybeSingle();

        if (existing) {
          await supabase.from("payroll_runs").update(run).eq("id", existing.id);
        } else {
          await supabase.from("payroll_runs").insert(run);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast({ title: "Payroll calculated", description: "Review and adjust allowance/commission/PCB before releasing." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const releaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_runs").update({
        status: "released" as any,
        released_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast({ title: "Payslip released" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const releaseAllMutation = useMutation({
    mutationFn: async () => {
      const draftIds = payrollRuns.filter((r: any) => r.status === "draft").map((r: any) => r.id);
      for (const id of draftIds) {
        const { error } = await supabase.from("payroll_runs").update({
          status: "released" as any,
          released_at: new Date().toISOString(),
        }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast({ title: "All payslips released" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateRunMutation = useMutation({
    mutationFn: async (run: any) => {
      const grossPay = Number(run.basic_pay) + Number(run.ot_pay) + Number(run.allowance) + Number(run.commission) + Number(run.holiday_pay) - Number(run.upl_deduction);
      const epfEmployee = calcEpfEmployee(grossPay);
      const epfEmployer = calcEpfEmployer(grossPay);
      const socso = calcSocso(grossPay);
      const eis = calcEis(grossPay);
      const netPay = grossPay - epfEmployee - socso.employee - eis.employee - Number(run.pcb);

      const { error } = await supabase.from("payroll_runs").update({
        allowance: Number(run.allowance),
        commission: Number(run.commission),
        pcb: Number(run.pcb),
        gross_pay: Math.round(grossPay * 100) / 100,
        epf_employee: epfEmployee,
        epf_employer: epfEmployer,
        socso_employee: socso.employee,
        socso_employer: socso.employer,
        eis_employee: eis.employee,
        eis_employer: eis.employer,
        net_pay: Math.round(netPay * 100) / 100,
      }).eq("id", run.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast({ title: "Updated" });
      setEditOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const downloadPayslip = async (run: any) => {
    const s = staff.find((st) => st.id === run.staff_profile_id);
    if (!s) return;
    const branch = branches.find((b: any) => b.id === s.branch_id);

    const blob = await generatePayslipPdf({
      companyName: "CATTOPIA SDN BHD",
      month: format(new Date(run.month), "MMMM yyyy"),
      staffId: s.staff_id,
      staffName: s.name,
      icNumber: s.ic_number,
      kwspNumber: s.kwsp_number ?? "",
      socsoNumber: s.socso_number ?? "",
      branchName: branch?.name ?? "—",
      employmentType: s.employment_type,
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
    a.download = `Payslip_${s.staff_id}_${format(new Date(run.month), "yyyy-MM")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStaffName = (profileId: string) => staff.find((s) => s.id === profileId)?.name ?? "Unknown";
  const getStaffId = (profileId: string) => staff.find((s) => s.id === profileId)?.staff_id ?? "—";
  const fmt = (n: number) => `RM ${Number(n).toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="space-y-1">
          <Label>Payroll Month</Label>
          <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-48" />
        </div>
        <div className="flex gap-2 items-end pt-5">
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            <Calculator className="h-4 w-4 mr-1" />
            {generateMutation.isPending ? "Calculating..." : "Calculate Payroll"}
          </Button>
          {payrollRuns.some((r: any) => r.status === "draft") && (
            <Button variant="outline" onClick={() => releaseAllMutation.mutate()} disabled={releaseAllMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Release All
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Basic</TableHead>
              <TableHead>OT</TableHead>
              <TableHead>Allowance</TableHead>
              <TableHead>Holiday</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>EPF</TableHead>
              <TableHead>SOCSO</TableHead>
              <TableHead>EIS</TableHead>
              <TableHead>PCB</TableHead>
              <TableHead>UPL</TableHead>
              <TableHead>Net Pay</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : payrollRuns.length === 0 ? (
              <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">No payroll data. Click "Calculate Payroll" to generate.</TableCell></TableRow>
            ) : (
              payrollRuns.map((run: any) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{getStaffName(run.staff_profile_id)}</p>
                      <p className="text-xs text-muted-foreground font-mono">{getStaffId(run.staff_profile_id)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{fmt(run.basic_pay)}</TableCell>
                  <TableCell className="text-sm">{fmt(run.ot_pay)}</TableCell>
                  <TableCell className="text-sm">{fmt(run.allowance)}</TableCell>
                  <TableCell className="text-sm">{fmt(run.holiday_pay)}</TableCell>
                  <TableCell className="text-sm font-medium">{fmt(run.gross_pay)}</TableCell>
                  <TableCell className="text-sm">{fmt(run.epf_employee)}</TableCell>
                  <TableCell className="text-sm">{fmt(run.socso_employee)}</TableCell>
                  <TableCell className="text-sm">{fmt(run.eis_employee)}</TableCell>
                  <TableCell className="text-sm">{fmt(run.pcb)}</TableCell>
                  <TableCell className="text-sm">{fmt(run.upl_deduction)}</TableCell>
                  <TableCell className="text-sm font-bold">{fmt(run.net_pay)}</TableCell>
                  <TableCell>
                    <Badge variant={run.status === "released" ? "default" : "secondary"}>
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {run.status === "draft" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => { setEditRun({ ...run }); setEditOpen(true); }} title="Edit allowance/commission/PCB">
                            <Calculator className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => releaseMutation.mutate(run.id)} title="Release payslip">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => downloadPayslip(run)} title="Download PDF">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) setEditOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Payroll — {editRun && getStaffName(editRun.staff_profile_id)}</DialogTitle></DialogHeader>
          {editRun && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Allowance (RM)</Label>
                  <Input type="number" step="0.01" value={editRun.allowance} onChange={(e) => setEditRun({ ...editRun, allowance: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Commission (RM)</Label>
                  <Input type="number" step="0.01" value={editRun.commission} onChange={(e) => setEditRun({ ...editRun, commission: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>PCB / Tax (RM)</Label>
                  <Input type="number" step="0.01" value={editRun.pcb} onChange={(e) => setEditRun({ ...editRun, pcb: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Statutory deductions (EPF, SOCSO, EIS) will be recalculated automatically.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button onClick={() => updateRunMutation.mutate(editRun)} disabled={updateRunMutation.isPending}>
                  {updateRunMutation.isPending ? "Saving..." : "Save & Recalculate"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayrollProcessing;
