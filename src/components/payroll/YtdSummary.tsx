import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const YtdSummary = () => {
  const currentYear = new Date().getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ["ytd-summary", currentYear],
    queryFn: async () => {
      const { data: runs, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .gte("month", `${currentYear}-01-01`)
        .lte("month", `${currentYear}-12-31`);
      if (error) throw error;
      return runs;
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const runs = data ?? [];
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No payroll data for {currentYear}.</p>;
  }

  // Group by month
  const byMonth: Record<string, typeof runs> = {};
  runs.forEach((r) => {
    const m = format(new Date(r.month), "yyyy-MM");
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(r);
  });

  const months = Object.keys(byMonth).sort();

  const fmt = (n: number) => `RM ${n.toFixed(2)}`;

  const totals = {
    gross: 0, epfEe: 0, epfEr: 0, socsoEe: 0, socsoEr: 0, eisEe: 0, eisEr: 0, pcb: 0, net: 0, headcount: 0,
  };

  const monthRows = months.map((m) => {
    const mRuns = byMonth[m];
    const gross = mRuns.reduce((s, r) => s + Number(r.gross_pay), 0);
    const epfEe = mRuns.reduce((s, r) => s + Number(r.epf_employee), 0);
    const epfEr = mRuns.reduce((s, r) => s + Number(r.epf_employer), 0);
    const socsoEe = mRuns.reduce((s, r) => s + Number(r.socso_employee), 0);
    const socsoEr = mRuns.reduce((s, r) => s + Number(r.socso_employer), 0);
    const eisEe = mRuns.reduce((s, r) => s + Number(r.eis_employee), 0);
    const eisEr = mRuns.reduce((s, r) => s + Number(r.eis_employer), 0);
    const pcb = mRuns.reduce((s, r) => s + Number(r.pcb), 0);
    const net = mRuns.reduce((s, r) => s + Number(r.net_pay), 0);

    totals.gross += gross;
    totals.epfEe += epfEe;
    totals.epfEr += epfEr;
    totals.socsoEe += socsoEe;
    totals.socsoEr += socsoEr;
    totals.eisEe += eisEe;
    totals.eisEr += eisEr;
    totals.pcb += pcb;
    totals.net += net;
    totals.headcount = Math.max(totals.headcount, mRuns.length);

    return { month: m, label: format(new Date(m + "-01"), "MMMM yyyy"), gross, epfEe, epfEr, socsoEe, socsoEr, eisEe, eisEr, pcb, net, count: mRuns.length };
  });

  const totalEmployerCost = totals.gross + totals.epfEr + totals.socsoEr + totals.eisEr;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">YTD Gross Pay</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(totals.gross)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">YTD Net Pay</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(totals.net)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Employer Cost</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(totalEmployerCost)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Months Processed</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{months.length} / 12</p></CardContent>
        </Card>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Staff</TableHead>
              <TableHead className="text-right">Gross Pay</TableHead>
              <TableHead className="text-right">EPF (EE+ER)</TableHead>
              <TableHead className="text-right">SOCSO (EE+ER)</TableHead>
              <TableHead className="text-right">EIS (EE+ER)</TableHead>
              <TableHead className="text-right">PCB</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthRows.map((r) => (
              <TableRow key={r.month}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-right">{r.count}</TableCell>
                <TableCell className="text-right">{fmt(r.gross)}</TableCell>
                <TableCell className="text-right">{fmt(r.epfEe + r.epfEr)}</TableCell>
                <TableCell className="text-right">{fmt(r.socsoEe + r.socsoEr)}</TableCell>
                <TableCell className="text-right">{fmt(r.eisEe + r.eisEr)}</TableCell>
                <TableCell className="text-right">{fmt(r.pcb)}</TableCell>
                <TableCell className="text-right font-medium">{fmt(r.net)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell>YTD Total</TableCell>
              <TableCell className="text-right">{totals.headcount}</TableCell>
              <TableCell className="text-right">{fmt(totals.gross)}</TableCell>
              <TableCell className="text-right">{fmt(totals.epfEe + totals.epfEr)}</TableCell>
              <TableCell className="text-right">{fmt(totals.socsoEe + totals.socsoEr)}</TableCell>
              <TableCell className="text-right">{fmt(totals.eisEe + totals.eisEr)}</TableCell>
              <TableCell className="text-right">{fmt(totals.pcb)}</TableCell>
              <TableCell className="text-right">{fmt(totals.net)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default YtdSummary;
