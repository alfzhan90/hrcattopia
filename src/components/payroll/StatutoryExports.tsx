import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Building2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type StaffProfile = Tables<"staff_profiles">;

const StatutoryExports = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const monthDate = `${selectedMonth}-01`;

  const { data: payrollRuns = [] } = useQuery({
    queryKey: ["payroll-runs-statutory", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("month", monthDate)
        .eq("status", "released" as any);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-statutory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("*");
      if (error) throw error;
      return data as StaffProfile[];
    },
  });

  const getStaff = (profileId: string) => staff.find((s) => s.id === profileId);

  const monthLabel = format(new Date(monthDate), "MMMM yyyy");
  const hasData = payrollRuns.length > 0;

  // EPF text file format (KWSP TXT)
  const downloadEpf = () => {
    const rows: string[] = [];
    rows.push(`EPF CONTRIBUTION - ${monthLabel}`);
    rows.push("EMPLOYER_NO|STAFF_ID|NAME|IC_NUMBER|KWSP_NO|EMPLOYEE_EPF|EMPLOYER_EPF|GROSS_PAY");
    for (const run of payrollRuns) {
      const s = getStaff(run.staff_profile_id);
      if (!s || s.employment_type === "Freelancer") continue;
      rows.push([
        "CATTOPIASDN", s.staff_id, s.name, s.ic_number,
        s.kwsp_number ?? "",
        Number(run.epf_employee).toFixed(2),
        Number(run.epf_employer).toFixed(2),
        Number(run.gross_pay).toFixed(2),
      ].join("|"));
    }
    const totalEe = payrollRuns.filter(r => getStaff(r.staff_profile_id)?.employment_type !== "Freelancer")
      .reduce((s, r) => s + Number(r.epf_employee), 0);
    const totalEr = payrollRuns.filter(r => getStaff(r.staff_profile_id)?.employment_type !== "Freelancer")
      .reduce((s, r) => s + Number(r.epf_employer), 0);
    rows.push(`TOTAL||EMPLOYEE_EPF|${totalEe.toFixed(2)}|EMPLOYER_EPF|${totalEr.toFixed(2)}`);
    const blob = new Blob([rows.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `EPF_${selectedMonth}.txt`;
    a.click();
  };

  // SOCSO CSV
  const downloadSocso = () => {
    const header = "No.,Staff ID,Name,IC Number,SOCSO Number,Gross Pay,Employee SOCSO,Employer SOCSO,Total";
    const rows = payrollRuns
      .filter(r => getStaff(r.staff_profile_id)?.employment_type !== "Freelancer")
      .map((run, i) => {
        const s = getStaff(run.staff_profile_id);
        const total = Number(run.socso_employee) + Number(run.socso_employer);
        return [
          i + 1, s?.staff_id ?? "", s?.name ?? "", s?.ic_number ?? "",
          s?.socso_number ?? "",
          Number(run.gross_pay).toFixed(2),
          Number(run.socso_employee).toFixed(2),
          Number(run.socso_employer).toFixed(2),
          total.toFixed(2),
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
      });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `SOCSO_${selectedMonth}.csv`;
    a.click();
  };

  // EIS CSV
  const downloadEis = () => {
    const header = "No.,Staff ID,Name,IC Number,Gross Pay,Employee EIS,Employer EIS,Total";
    const rows = payrollRuns
      .filter(r => getStaff(r.staff_profile_id)?.employment_type !== "Freelancer")
      .map((run, i) => {
        const s = getStaff(run.staff_profile_id);
        const total = Number(run.eis_employee) + Number(run.eis_employer);
        return [
          i + 1, s?.staff_id ?? "", s?.name ?? "", s?.ic_number ?? "",
          Number(run.gross_pay).toFixed(2),
          Number(run.eis_employee).toFixed(2),
          Number(run.eis_employer).toFixed(2),
          total.toFixed(2),
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
      });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `EIS_${selectedMonth}.csv`;
    a.click();
  };

  // Maybank bulk payment (direct credit) CSV
  const downloadMaybank = () => {
    const header = "No.,Recipient Name,Bank Account Number,Amount (RM),Payment Reference,Remarks";
    const rows = payrollRuns.map((run, i) => {
      const s = getStaff(run.staff_profile_id);
      const ref = `SALARY-${selectedMonth}-${s?.staff_id ?? ""}`;
      return [
        i + 1,
        s?.name ?? "",
        (s as any)?.bank_account_number ?? "",
        Number(run.net_pay).toFixed(2),
        ref,
        `Salary ${monthLabel}`,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Maybank_Salary_${selectedMonth}.csv`;
    a.click();
  };

  const exports = [
    {
      id: "epf",
      title: "EPF / KWSP",
      description: "Employee and employer EPF contributions in TXT format for KWSP i-Akaun upload",
      icon: <FileText className="h-5 w-5 text-blue-600" />,
      action: downloadEpf,
      ext: "TXT",
    },
    {
      id: "socso",
      title: "SOCSO / PERKESO",
      description: "SOCSO contribution schedule CSV for ASSIST portal submission",
      icon: <FileText className="h-5 w-5 text-green-600" />,
      action: downloadSocso,
      ext: "CSV",
    },
    {
      id: "eis",
      title: "EIS / SIP",
      description: "EIS contribution schedule CSV for EIS portal submission",
      icon: <FileText className="h-5 w-5 text-purple-600" />,
      action: downloadEis,
      ext: "CSV",
    },
    {
      id: "maybank",
      title: "Maybank Direct Credit",
      description: "Bank transfer file for Maybank2u Business bulk salary payment",
      icon: <Building2 className="h-5 w-5 text-amber-600" />,
      action: downloadMaybank,
      ext: "CSV",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Label>Payroll Month</Label>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-48"
          />
        </div>
        <div className="pt-5">
          {hasData ? (
            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
              {payrollRuns.length} released payslips
            </Badge>
          ) : (
            <Badge variant="secondary">No released payslips for this month</Badge>
          )}
        </div>
      </div>

      {!hasData && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          Release payslips first (Payroll tab) before downloading statutory files.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {exports.map((exp) => (
          <Card key={exp.id} className={!hasData ? "opacity-50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {exp.icon}
                {exp.title}
                <Badge variant="outline" className="ml-auto text-xs font-mono">{exp.ext}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{exp.description}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={exp.action}
                disabled={!hasData}
                className="w-full"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download {exp.title}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasData && (
        <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg space-y-1">
          <p className="font-medium text-foreground">Before submitting:</p>
          <p>• EPF: upload TXT to <span className="font-mono">kwspkebajikan.com.my</span> → i-Akaun → Caruman</p>
          <p>• SOCSO/EIS: upload CSV to <span className="font-mono">assist.socso.gov.my</span></p>
          <p>• Maybank: import CSV in Maybank2u Business → Bulk Payment → Direct Credit</p>
          <p>• Verify bank account numbers are set on each staff profile before downloading bank file.</p>
        </div>
      )}
    </div>
  );
};

export default StatutoryExports;
