import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, DollarSign } from "lucide-react";
import { generateFreelancerInvoicePdf } from "@/lib/freelancer-invoice-pdf";
import { getPayPeriod } from "@/lib/payroll";
import { format } from "date-fns";

const StaffInvoices = () => {
  const { user } = useAuth();
  const [preview, setPreview] = useState<any>(null);
  const { data: companySettings } = useCompanySettings();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["my-invoices", profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from("freelancer_invoices").select("*")
        .eq("staff_profile_id", profile!.id)
        .order("month", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile,
  });

  // Current cycle earnings
  const currentMonth = format(new Date(), "yyyy-MM");
  const period = getPayPeriod(currentMonth);
  const { data: currentHours = 0 } = useQuery({
    queryKey: ["my-cycle-hours", user?.id, currentMonth],
    queryFn: async () => {
      const { data } = await supabase.from("attendance_logs").select("net_hours")
        .eq("user_id", user!.id)
        .gte("check_in_time", period.start)
        .lte("check_in_time", period.end + "T23:59:59");
      return (data ?? []).reduce((s, r) => s + Number(r.net_hours), 0);
    },
    enabled: !!user,
  });

  const currentEarnings = currentHours * Number(profile?.base_rate ?? 0);

  const downloadInvoice = async (inv: any) => {
    if (!profile) return;
    const blob = await generateFreelancerInvoicePdf({
      companyName: companySettings?.company_name || "Company",
      companyAddress: companySettings?.address || "",
      companySSM: companySettings?.ssm_number || "",
      invoiceNumber: inv.invoice_number,
      freelancerName: profile.name,
      freelancerIC: profile.ic_number,
      freelancerStaffId: profile.staff_id,
      bankName: (profile as any).bank_name ?? "",
      bankAccount: (profile as any).bank_account_number ?? "",
      month: format(new Date(inv.month), "MMMM yyyy"),
      periodLabel: getPayPeriod(format(new Date(inv.month), "yyyy-MM")).label,
      serviceDescription: inv.service_description,
      totalHours: Number(inv.total_hours),
      hourlyRate: Number(inv.hourly_rate),
      totalPayable: Number(inv.total_payable),
      eInvoiceId: inv.e_invoice_id ?? "",
      paymentDueDate: inv.payment_due_date ? format(new Date(inv.payment_due_date), "dd MMM yyyy") : "",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${inv.invoice_number}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
      <h1 className="text-xl font-bold">My Invoices</h1>

      {/* Current Cycle Earnings */}
      <Card className="rounded-xl bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current Cycle Earnings</p>
            <p className="text-lg font-bold">RM {currentEarnings.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{currentHours.toFixed(1)} hrs × RM {Number(profile?.base_rate ?? 0).toFixed(2)}/hr</p>
          </div>
        </CardContent>
      </Card>

      {invoices.length === 0 ? (
        <Card className="rounded-xl"><CardContent className="p-6 text-center text-sm text-muted-foreground">No invoices yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv: any) => (
            <Card key={inv.id} className="rounded-xl cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setPreview(inv)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{format(new Date(inv.month), "MMMM yyyy")}</p>
                  <p className="text-xs text-muted-foreground">{inv.invoice_number}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">RM {Number(inv.total_payable).toFixed(2)}</p>
                  <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="text-[10px]">{inv.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-[95vw] rounded-2xl">
          <DialogHeader><DialogTitle>Invoice — {preview && format(new Date(preview.month), "MMMM yyyy")}</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Invoice #</span><span className="font-mono">{preview.invoice_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span>{preview.service_description}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Hours</span><span>{Number(preview.total_hours).toFixed(1)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span>RM {Number(preview.hourly_rate).toFixed(2)}/hr</span></div>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Payable</span><span className="text-green-600">RM {Number(preview.total_payable).toFixed(2)}</span>
                </div>
              </div>
              <Button className="w-full h-12 rounded-xl" onClick={() => downloadInvoice(preview)}>
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffInvoices;
