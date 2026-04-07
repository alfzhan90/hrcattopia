import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, Users } from "lucide-react";
import { toast } from "sonner";
import { generateEAFormPdf, type EAFormData } from "@/lib/ea-form-pdf";
import { generateCP8DFile, type CP8DEmployeeRow, type CP8DHeader } from "@/lib/cp8d-generator";

const TaxCompliance = () => {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const { data: company } = useCompanySettings();

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ["tax-staff", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("*")
        .neq("employment_type", "Freelancer");
      if (error) throw error;
      return data;
    },
  });

  const { data: payrollRuns, isLoading: payrollLoading } = useQuery({
    queryKey: ["tax-payroll", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .gte("month", `${year}-01-01`)
        .lte("month", `${year}-12-31`);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = staffLoading || payrollLoading;
  const fmt = (n: number) => `RM ${n.toFixed(2)}`;

  // Aggregate per staff
  const staffSummaries = (staff ?? []).map((s) => {
    const runs = (payrollRuns ?? []).filter((r) => r.staff_profile_id === s.id);
    const grossSalary = runs.reduce((t, r) => t + Number(r.basic_pay), 0);
    const otPay = runs.reduce((t, r) => t + Number(r.ot_pay), 0);
    const allowances = runs.reduce((t, r) => t + Number(r.allowance), 0);
    const commissions = runs.reduce((t, r) => t + Number(r.commission), 0);
    const holidayPay = runs.reduce((t, r) => t + Number(r.holiday_pay), 0);
    const totalGross = runs.reduce((t, r) => t + Number(r.gross_pay), 0);
    const epfEmployee = runs.reduce((t, r) => t + Number(r.epf_employee), 0);
    const socsoEmployee = runs.reduce((t, r) => t + Number(r.socso_employee), 0);
    const eisEmployee = runs.reduce((t, r) => t + Number(r.eis_employee), 0);
    const pcb = runs.reduce((t, r) => t + Number(r.pcb), 0);
    const totalDeductions = epfEmployee + socsoEmployee + eisEmployee + pcb;
    const netPay = runs.reduce((t, r) => t + Number(r.net_pay), 0);
    return {
      ...s,
      monthsWorked: runs.length,
      grossSalary, otPay, allowances, commissions, holidayPay,
      totalGross, epfEmployee, socsoEmployee, eisEmployee, pcb,
      totalDeductions, netPay,
    };
  });

  const grandTotals = {
    totalGross: staffSummaries.reduce((s, r) => s + r.totalGross, 0),
    totalEpf: staffSummaries.reduce((s, r) => s + r.epfEmployee, 0),
    totalSocso: staffSummaries.reduce((s, r) => s + r.socsoEmployee, 0),
    totalEis: staffSummaries.reduce((s, r) => s + r.eisEmployee, 0),
    totalPcb: staffSummaries.reduce((s, r) => s + r.pcb, 0),
    totalNet: staffSummaries.reduce((s, r) => s + r.netPay, 0),
    headcount: staffSummaries.length,
    withPcb: staffSummaries.filter((s) => s.pcb > 0).length,
  };

  const handleDownloadEA = (staffId: string) => {
    const s = staffSummaries.find((x) => x.id === staffId);
    if (!s) return;
    const eaData: EAFormData = {
      year: Number(year),
      companyName: company?.company_name || "",
      companyAddress: company?.address || "",
      ssmNumber: company?.ssm_number || "",
      staffName: s.name,
      staffId: s.staff_id,
      icNumber: s.ic_number,
      passportNumber: (s as any).passport_number || undefined,
      taxRefNumber: (s as any).tax_reference_number || undefined,
      kwspNumber: s.kwsp_number || undefined,
      socsoNumber: s.socso_number || undefined,
      grossSalary: s.grossSalary,
      allowances: s.allowances,
      commissions: s.commissions,
      otPay: s.otPay,
      holidayPay: s.holidayPay,
      totalGross: s.totalGross,
      epfEmployee: s.epfEmployee,
      socsoEmployee: s.socsoEmployee,
      eisEmployee: s.eisEmployee,
      pcb: s.pcb,
      totalDeductions: s.totalDeductions,
      netPay: s.netPay,
      monthsWorked: s.monthsWorked,
    };
    const doc = generateEAFormPdf(eaData);
    doc.save(`EA_${year}_${s.staff_id}_${s.name.replace(/\s+/g, "_")}.pdf`);
    toast.success(`EA Form downloaded for ${s.name}`);
  };

  const handleDownloadAllEA = () => {
    staffSummaries.forEach((s) => handleDownloadEA(s.id));
    toast.success(`Downloaded ${staffSummaries.length} EA Forms`);
  };

  const handleDownloadCP8D = () => {
    const rows: CP8DEmployeeRow[] = staffSummaries.map((s) => ({
      name: s.name,
      icNumber: s.ic_number,
      passportNumber: (s as any).passport_number || "",
      taxRefNumber: (s as any).tax_reference_number || "",
      totalGross: s.totalGross,
      totalMtd: s.pcb,
      totalEpfEmployee: s.epfEmployee,
    }));
    const header: CP8DHeader = {
      employerName: company?.company_name || "",
      employerTaxRef: company?.ssm_number || "",
      year: Number(year),
      totalEmployees: rows.length,
    };
    const content = generateCP8DFile(header, rows);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CP8D_${year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CP8D file downloaded");
  };

  if (isLoading) return <Skeleton className="h-60 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Tax Year:</label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleDownloadAllEA} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-1" /> Download All EA Forms
          </Button>
          <Button onClick={handleDownloadCP8D} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Export CP8D (.txt)
          </Button>
        </div>
      </div>

      <Tabs defaultValue="form-e">
        <TabsList>
          <TabsTrigger value="form-e">Form E Summary</TabsTrigger>
          <TabsTrigger value="ea-forms">EA Forms</TabsTrigger>
        </TabsList>

        <TabsContent value="form-e" className="mt-4 space-y-4">
          {/* Form E Summary Cards */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4" /> Total Employees
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{grandTotals.headcount}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Subject to PCB</CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{grandTotals.withPcb}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Gross Remuneration</CardTitle>
              </CardHeader>
              <CardContent><p className="text-xl font-bold">{fmt(grandTotals.totalGross)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total PCB / MTD</CardTitle>
              </CardHeader>
              <CardContent><p className="text-xl font-bold">{fmt(grandTotals.totalPcb)}</p></CardContent>
            </Card>
          </div>

          {/* Statutory Totals */}
          <Card>
            <CardHeader><CardTitle className="text-base">Statutory Contribution Totals</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">EPF (Employee)</p>
                  <p className="text-lg font-semibold">{fmt(grandTotals.totalEpf)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SOCSO (Employee)</p>
                  <p className="text-lg font-semibold">{fmt(grandTotals.totalSocso)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">EIS (Employee)</p>
                  <p className="text-lg font-semibold">{fmt(grandTotals.totalEis)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Net Pay</p>
                  <p className="text-lg font-semibold">{fmt(grandTotals.totalNet)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ea-forms" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Months</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">EPF</TableHead>
                  <TableHead className="text-right">PCB</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-center">EA Form</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No staff payroll data for {year}.
                    </TableCell>
                  </TableRow>
                ) : (
                  staffSummaries.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.staff_id}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right">{s.monthsWorked}</TableCell>
                      <TableCell className="text-right">{fmt(s.totalGross)}</TableCell>
                      <TableCell className="text-right">{fmt(s.epfEmployee)}</TableCell>
                      <TableCell className="text-right">{fmt(s.pcb)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(s.netPay)}</TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadEA(s.id)}>
                          <Download className="h-4 w-4" />
                        </Button>
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
  );
};

export default TaxCompliance;
