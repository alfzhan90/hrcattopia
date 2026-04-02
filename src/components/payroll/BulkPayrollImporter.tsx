import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, AlertTriangle, CheckCircle, FileSpreadsheet } from "lucide-react";
import { calcSocso, calcEis } from "@/lib/payroll";
import * as XLSX from "xlsx";

interface ParsedRow {
  staffId: string;
  month: string;
  basicPay: number;
  allowance: number;
  commission: number;
  otPay: number;
  holidayPay: number;
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  socsoEmployer: number;
  eisEmployee: number;
  eisEmployer: number;
  pcb: number;
  netPay: number;
  warnings: string[];
  profileId?: string;
  profileName?: string;
}

const MONTH_MAP: Record<string, string> = {
  january: "01", jan: "01", "1": "01", "01": "01",
  february: "02", feb: "02", "2": "02", "02": "02",
  march: "03", mar: "03", "3": "03", "03": "03",
  april: "04", apr: "04", "4": "04", "04": "04",
  may: "05", "5": "05", "05": "05",
  june: "06", jun: "06", "6": "06", "06": "06",
  july: "07", jul: "07", "7": "07", "07": "07",
  august: "08", aug: "08", "8": "08", "08": "08",
  september: "09", sep: "09", "9": "09", "09": "09",
  october: "10", oct: "10", "10": "10",
  november: "11", nov: "11", "11": "11",
  december: "12", dec: "12", "12": "12",
};

const parseMonth = (val: string): string | null => {
  const s = String(val).trim().toLowerCase();
  // Try yyyy-MM or yyyy-MM-dd
  if (/^\d{4}-\d{2}/.test(s)) return s.substring(0, 7) + "-01";
  // Try "January 2026" or "Jan 2026"
  const parts = s.split(/[\s\/\-]+/);
  if (parts.length >= 2) {
    const monthPart = MONTH_MAP[parts[0]];
    const yearPart = parts[1]?.length === 4 ? parts[1] : null;
    if (monthPart && yearPart) return `${yearPart}-${monthPart}-01`;
    // Try MM/YYYY
    const mp2 = MONTH_MAP[parts[0]];
    const yp2 = parts[1]?.length === 4 ? parts[1] : null;
    if (mp2 && yp2) return `${yp2}-${mp2}-01`;
  }
  return null;
};

const num = (v: any) => {
  const n = Number(v);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
};

const BulkPayrollImporter = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-profiles-import"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("id, staff_id, name, base_rate");
      if (error) throw error;
      return data;
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (json.length === 0) {
      toast({ title: "Empty file", variant: "destructive" });
      return;
    }

    // Try to find column mappings (case-insensitive, flexible)
    const colMap = (row: any) => {
      const keys = Object.keys(row);
      const find = (...terms: string[]) => {
        for (const t of terms) {
          const k = keys.find((k) => k.toLowerCase().includes(t.toLowerCase()));
          if (k) return row[k];
        }
        return "";
      };
      return {
        staffId: String(find("staff id", "staff_id", "staffid", "CT") || "").trim(),
        month: String(find("month", "period") || ""),
        basicPay: num(find("basic", "base")),
        allowance: num(find("allowance")),
        commission: num(find("commission")),
        otPay: num(find("ot", "overtime")),
        holidayPay: num(find("holiday")),
        epfEmployee: num(find("epf employee", "epf_employee", "epf ee", "epf emp")),
        epfEmployer: num(find("epf employer", "epf_employer", "epf er")),
        socsoEmployee: num(find("socso employee", "socso_employee", "socso ee", "socso emp")),
        socsoEmployer: num(find("socso employer", "socso_employer", "socso er")),
        eisEmployee: num(find("eis employee", "eis_employee", "eis ee", "eis emp")),
        eisEmployer: num(find("eis employer", "eis_employer", "eis er")),
        pcb: num(find("pcb", "mtd", "tax")),
        netPay: num(find("net pay", "net_pay", "nett")),
      };
    };

    const rows: ParsedRow[] = json.map((row) => {
      const mapped = colMap(row);
      const warnings: string[] = [];

      // Match staff
      const profile = staff.find((s) => s.staff_id.toLowerCase() === mapped.staffId.toLowerCase());
      if (!profile) warnings.push(`Staff ID "${mapped.staffId}" not found`);

      // Parse month
      const monthDate = parseMonth(mapped.month);
      if (!monthDate) warnings.push(`Cannot parse month "${mapped.month}"`);

      // Validate SOCSO/EIS against 2026 ceilings
      const grossForCheck = mapped.basicPay + mapped.otPay + mapped.allowance + mapped.commission + mapped.holidayPay;
      if (grossForCheck > 0) {
        const expectedSocso = calcSocso(grossForCheck);
        const expectedEis = calcEis(grossForCheck);

        if (mapped.socsoEmployee > 0 && Math.abs(mapped.socsoEmployee - expectedSocso.employee) > 1) {
          warnings.push(`SOCSO EE: imported RM${mapped.socsoEmployee} vs expected RM${expectedSocso.employee}`);
        }
        if (mapped.socsoEmployer > 0 && Math.abs(mapped.socsoEmployer - expectedSocso.employer) > 1) {
          warnings.push(`SOCSO ER: imported RM${mapped.socsoEmployer} vs expected RM${expectedSocso.employer}`);
        }
        if (mapped.eisEmployee > 0 && Math.abs(mapped.eisEmployee - expectedEis.employee) > 0.5) {
          warnings.push(`EIS EE: imported RM${mapped.eisEmployee} vs expected RM${expectedEis.employee}`);
        }
      }

      return {
        ...mapped,
        month: monthDate ?? "",
        warnings,
        profileId: profile?.id,
        profileName: profile?.name,
      };
    });

    setParsedRows(rows);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = parsedRows.filter((r) => r.profileId && r.month);
      if (validRows.length === 0) throw new Error("No valid rows to import");

      for (const r of validRows) {
        // Check if already exists
        const { data: existing } = await supabase
          .from("payroll_runs")
          .select("id")
          .eq("month", r.month)
          .eq("staff_profile_id", r.profileId!)
          .maybeSingle();

        const grossPay = r.basicPay + r.otPay + r.allowance + r.commission + r.holidayPay;

        const record = {
          month: r.month,
          staff_profile_id: r.profileId!,
          basic_pay: r.basicPay,
          ot_pay: r.otPay,
          allowance: r.allowance,
          commission: r.commission,
          holiday_pay: r.holidayPay,
          gross_pay: grossPay,
          epf_employee: r.epfEmployee,
          epf_employer: r.epfEmployer,
          socso_employee: r.socsoEmployee,
          socso_employer: r.socsoEmployer,
          eis_employee: r.eisEmployee,
          eis_employer: r.eisEmployer,
          pcb: r.pcb,
          upl_deduction: 0,
          late_deduction: 0,
          net_pay: r.netPay,
          status: "released" as const,
          released_at: new Date().toISOString(),
        };

        if (existing) {
          await supabase.from("payroll_runs").update(record).eq("id", existing.id);
        } else {
          await supabase.from("payroll_runs").insert(record);
        }
      }
      return validRows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["ytd-summary"] });
      toast({ title: "Import complete", description: `${count} payroll records imported and released.` });
      setParsedRows([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err: any) => toast({ title: "Import error", description: err.message, variant: "destructive" }),
  });

  const validCount = parsedRows.filter((r) => r.profileId && r.month).length;
  const warningCount = parsedRows.filter((r) => r.warnings.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Import Historical Payroll</h3>
        <p className="text-sm text-muted-foreground">
          Upload an Excel file with columns: Staff ID, Month, Basic Salary, Allowances, Commission, OT Pay, Holiday Pay, EPF (EE/ER), SOCSO (EE/ER), EIS (EE/ER), PCB, Net Pay.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          className="hidden"
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          Choose File
        </Button>
        {fileName && (
          <span className="text-sm flex items-center gap-1">
            <FileSpreadsheet className="h-4 w-4" />
            {fileName}
          </span>
        )}
      </div>

      {parsedRows.length > 0 && (
        <>
          <div className="flex items-center gap-4">
            <Badge variant="secondary">{parsedRows.length} rows parsed</Badge>
            <Badge variant={validCount === parsedRows.length ? "default" : "destructive"}>
              {validCount} valid
            </Badge>
            {warningCount > 0 && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {warningCount} with warnings
              </Badge>
            )}
          </div>

          <div className="rounded-lg border overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">OT</TableHead>
                  <TableHead className="text-right">Allowance</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">EPF EE</TableHead>
                  <TableHead className="text-right">SOCSO EE</TableHead>
                  <TableHead className="text-right">EIS EE</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.map((row, i) => (
                  <TableRow key={i} className={row.warnings.length > 0 ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                    <TableCell className="font-mono text-xs">{row.staffId}</TableCell>
                    <TableCell>{row.profileName ?? "—"}</TableCell>
                    <TableCell>{row.month || "Invalid"}</TableCell>
                    <TableCell className="text-right">{row.basicPay.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.otPay.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.allowance.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.commission.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.epfEmployee.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.socsoEmployee.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.eisEmployee.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">{row.netPay.toFixed(2)}</TableCell>
                    <TableCell>
                      {row.profileId && row.month ? (
                        row.warnings.length > 0 ? (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">Review</Badge>
                        ) : (
                          <Badge className="bg-green-600 text-xs">Ready</Badge>
                        )
                      ) : (
                        <Badge variant="destructive" className="text-xs">Error</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Warnings detail */}
          {parsedRows.some((r) => r.warnings.length > 0) && (
            <Alert variant="default" className="border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1 text-sm">
                  {parsedRows.flatMap((r, i) =>
                    r.warnings.map((w, j) => (
                      <li key={`${i}-${j}`}>
                        Row {i + 1} ({r.staffId}): {w}
                      </li>
                    ))
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || validCount === 0}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {importMutation.isPending ? "Importing..." : `Import & Release ${validCount} Records`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setParsedRows([]);
                setFileName("");
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Clear
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default BulkPayrollImporter;
