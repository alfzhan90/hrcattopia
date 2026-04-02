import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download } from "lucide-react";
import { generatePayslipPdf } from "@/lib/payslip-pdf";
import { getPayPeriod } from "@/lib/payroll";
import { format } from "date-fns";

const StaffPayslips = () => {
  const { user } = useAuth();
  const [preview, setPreview] = useState<any>(null);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: branch } = useQuery({
    queryKey: ["my-branch", profile?.branch_id],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("id", profile!.branch_id!).single();
      return data;
    },
    enabled: !!profile?.branch_id,
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ["my-payslips", profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from("payroll_runs").select("*")
        .eq("staff_profile_id", profile!.id).eq("status", "released")
        .order("month", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile,
  });

  const downloadPayslip = async (run: any) => {
    if (!profile) return;
    const period = getPayPeriod(format(new Date(run.month), "yyyy-MM"));
    const blob = await generatePayslipPdf({
      companyName: "CATTOPIA SDN BHD",
      periodLabel: period.label,
      month: format(new Date(run.month), "MMMM yyyy"),
      staffId: profile.staff_id, staffName: profile.name, icNumber: profile.ic_number,
      kwspNumber: profile.kwsp_number ?? "", socsoNumber: profile.socso_number ?? "",
      branchName: branch?.name ?? "—", employmentType: profile.employment_type,
      basicPay: Number(run.basic_pay), otPay: Number(run.ot_pay), allowance: Number(run.allowance),
      commission: Number(run.commission), holidayPay: Number(run.holiday_pay), grossPay: Number(run.gross_pay),
      epfEmployee: Number(run.epf_employee), epfEmployer: Number(run.epf_employer),
      socsoEmployee: Number(run.socso_employee), socsoEmployer: Number(run.socso_employer),
      eisEmployee: Number(run.eis_employee), eisEmployer: Number(run.eis_employer),
      pcb: Number(run.pcb), uplDeduction: Number(run.upl_deduction), netPay: Number(run.net_pay),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Payslip_${profile.staff_id}_${format(new Date(run.month), "yyyy-MM")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => `RM ${n.toFixed(2)}`;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
      <h1 className="text-xl font-bold">Payslips</h1>

      {payslips.length === 0 ? (
        <Card className="rounded-xl"><CardContent className="p-6 text-center text-sm text-muted-foreground">No payslips released yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {payslips.map((p: any) => (
            <Card key={p.id} className="rounded-xl cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setPreview(p)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{format(new Date(p.month), "MMMM yyyy")}</p>
                  <p className="text-xs text-muted-foreground">
                    {getPayPeriod(format(new Date(p.month), "yyyy-MM")).label}
                  </p>
                </div>
                <p className="font-bold text-sm">RM {Number(p.net_pay).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Payslip Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-[95vw] rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Payslip — {preview && format(new Date(preview.month), "MMMM yyyy")}</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Earnings</h3>
                <div className="space-y-1">
                  {[["Basic Pay", preview.basic_pay], ["OT Pay", preview.ot_pay], ["Allowance", preview.allowance],
                    ["Commission", preview.commission], ["Holiday Pay", preview.holiday_pay]].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between">
                      <span className="text-muted-foreground">{l}</span><span>{fmt(Number(v))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                    <span>Gross Pay</span><span>{fmt(Number(preview.gross_pay))}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Deductions</h3>
                <div className="space-y-1">
                  {[["EPF (11%)", preview.epf_employee], ["SOCSO", preview.socso_employee], ["EIS", preview.eis_employee],
                    ["PCB", preview.pcb], ["Unpaid Leave", preview.upl_deduction]].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between">
                      <span className="text-muted-foreground">{l}</span><span className="text-destructive">-{fmt(Number(v))}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>Net Pay</span><span className="text-green-600">{fmt(Number(preview.net_pay))}</span>
                </div>
              </div>
              <Button className="w-full h-12 rounded-xl" onClick={() => downloadPayslip(preview)}>
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffPayslips;
