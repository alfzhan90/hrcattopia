import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { getPayPeriod } from "@/lib/payroll";
import { generateFreelancerInvoicePdf } from "@/lib/freelancer-invoice-pdf";
import { useCompanySettings } from "@/hooks/use-company-settings";
import type { Tables as DBTables } from "@/integrations/supabase/types";

type StaffProfile = DBTables<"staff_profiles">;
type Branch = DBTables<"branches">;

const Freelancers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const { data: companySettings } = useCompanySettings();

  const [form, setForm] = useState({
    name: "", email: "", ic_number: "", phone_number: "", bank_name: "", bank_account_number: "",
    base_rate: "0", branch_id: "",
  });

  const [editForm, setEditForm] = useState<{
    id: string; name: string; ic_number: string; phone_number: string;
    bank_name: string; bank_account_number: string; base_rate: string; branch_id: string;
  } | null>(null);

  const { data: freelancers = [], isLoading } = useQuery({
    queryKey: ["freelancers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles").select("*")
        .eq("employment_type", "Freelancer")
        .order("name");
      if (error) throw error;
      return data as (StaffProfile & { phone_number?: string; bank_name?: string; bank_account_number?: string })[];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  // Invoices for current month
  const { data: invoices = [] } = useQuery({
    queryKey: ["freelancer-invoices", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freelancer_invoices").select("*, staff_profiles(name, staff_id, ic_number, bank_name, bank_account_number)")
        .eq("month", `${selectedMonth}-01`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Attendance logs for freelancers in current pay period
  const period = getPayPeriod(selectedMonth);
  const { data: freelancerLogs = [] } = useQuery({
    queryKey: ["freelancer-logs", selectedMonth],
    queryFn: async () => {
      const freelancerIds = freelancers.map((f) => f.user_id);
      if (freelancerIds.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance_logs").select("*")
        .in("user_id", freelancerIds)
        .gte("check_in_time", period.start)
        .lte("check_in_time", period.end + "T23:59:59");
      if (error) throw error;
      return data;
    },
    enabled: freelancers.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: {
          email: values.email, name: values.name, ic_number: values.ic_number,
          employment_type: "Freelancer", base_rate: values.base_rate, ot_rate_per_hour: "0",
          branch_id: values.branch_id || null,
          phone_number: values.phone_number, bank_name: values.bank_name,
          bank_account_number: values.bank_account_number,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancers"] });
      toast({ title: "Freelancer invited", description: "An invitation email has been sent." });
      setDialogOpen(false);
      setForm({ name: "", email: "", ic_number: "", phone_number: "", bank_name: "", bank_account_number: "", base_rate: "0", branch_id: "" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: NonNullable<typeof editForm>) => {
      const { error } = await supabase.from("staff_profiles").update({
        name: values.name, ic_number: values.ic_number,
        phone_number: values.phone_number, bank_name: values.bank_name,
        bank_account_number: values.bank_account_number,
        base_rate: parseFloat(values.base_rate) || 0,
        branch_id: values.branch_id || null,
      } as any).eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancers"] });
      toast({ title: "Updated", description: "Freelancer profile saved." });
      setEditDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async (freelancer: StaffProfile & { phone_number?: string; bank_name?: string; bank_account_number?: string }) => {
      const logs = freelancerLogs.filter((l) => l.user_id === freelancer.user_id);
      const totalHours = logs.reduce((s, l) => s + Number(l.net_hours), 0);
      const hourlyRate = Number(freelancer.base_rate);
      const totalPayable = Math.round(totalHours * hourlyRate * 100) / 100;
      const invoiceNumber = `INV-${freelancer.staff_id}-${selectedMonth.replace("-", "")}`;

      const { error } = await supabase.from("freelancer_invoices").upsert({
        staff_profile_id: freelancer.id,
        month: `${selectedMonth}-01`,
        total_hours: Math.round(totalHours * 100) / 100,
        hourly_rate: hourlyRate,
        total_payable: totalPayable,
        invoice_number: invoiceNumber,
        payment_due_date: new Date(new Date(`${selectedMonth}-01`).getFullYear(), new Date(`${selectedMonth}-01`).getMonth() + 1, 7).toISOString().split("T")[0],
        status: "issued",
      } as any, { onConflict: "staff_profile_id,month" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer-invoices"] });
      toast({ title: "Invoice generated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const downloadInvoice = async (invoice: any) => {
    const blob = await generateFreelancerInvoicePdf({
      companyName: companySettings?.company_name || "Company",
      companyAddress: companySettings?.address || "",
      companySSM: companySettings?.ssm_number || "",
      invoiceNumber: invoice.invoice_number,
      freelancerName: invoice.staff_profiles?.name ?? "Unknown",
      freelancerIC: invoice.staff_profiles?.ic_number ?? "",
      freelancerStaffId: invoice.staff_profiles?.staff_id ?? "",
      bankName: (invoice.staff_profiles as any)?.bank_name ?? "",
      bankAccount: (invoice.staff_profiles as any)?.bank_account_number ?? "",
      month: format(new Date(invoice.month), "MMMM yyyy"),
      periodLabel: getPayPeriod(format(new Date(invoice.month), "yyyy-MM")).label,
      serviceDescription: invoice.service_description,
      totalHours: Number(invoice.total_hours),
      hourlyRate: Number(invoice.hourly_rate),
      totalPayable: Number(invoice.total_payable),
      eInvoiceId: invoice.e_invoice_id ?? "",
      paymentDueDate: invoice.payment_due_date ? format(new Date(invoice.payment_due_date), "dd MMM yyyy") : "",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${invoice.invoice_number}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredFreelancers = freelancers.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.staff_id.toLowerCase().includes(search.toLowerCase()) ||
    f.ic_number.includes(search)
  );

  const getBranchName = (id: string | null) => id ? branches.find((b) => b.id === id)?.name ?? "—" : "—";

  const formatIcNumber = (value: string) => {
    const raw = value.replace(/[^0-9]/g, "").slice(0, 12);
    return raw.length > 8 ? `${raw.slice(0, 6)}-${raw.slice(6, 8)}-${raw.slice(8)}` : raw.length > 6 ? `${raw.slice(0, 6)}-${raw.slice(6)}` : raw;
  };

  const getFreelancerHours = (userId: string) => {
    return freelancerLogs.filter((l) => l.user_id === userId).reduce((s, l) => s + Number(l.net_hours), 0);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Freelancer Management</h1>
          <p className="text-muted-foreground">Manage casual workers, attendance, and invoices.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Freelancer</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add New Freelancer</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>IC/Passport</Label><Input value={form.ic_number} onChange={(e) => setForm({ ...form, ic_number: formatIcNumber(e.target.value) })} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone Number</Label><Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></div>
                <div className="space-y-2"><Label>Hourly Rate (RM)</Label><Input type="number" step="0.01" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Bank Name</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Bank Account No.</Label><Input value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Assigned Branch</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Sending..." : "Invite Freelancer"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="roster">
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>IC/Passport</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Rate/hr</TableHead>
                  <TableHead>Cycle Hours</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filteredFreelancers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No freelancers yet.</TableCell></TableRow>
                ) : (
                  filteredFreelancers.map((f) => {
                    const hours = getFreelancerHours(f.user_id);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono text-sm">{f.staff_id}</TableCell>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.ic_number}</TableCell>
                        <TableCell>{getBranchName(f.branch_id)}</TableCell>
                        <TableCell>RM {Number(f.base_rate).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={hours > 0 ? "default" : "secondary"}>{hours.toFixed(1)}h</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditForm({
                                id: f.id, name: f.name, ic_number: f.ic_number,
                                phone_number: (f as any).phone_number || "",
                                bank_name: (f as any).bank_name || "",
                                bank_account_number: (f as any).bank_account_number || "",
                                base_rate: String(f.base_rate), branch_id: f.branch_id || "",
                              });
                              setEditDialogOpen(true);
                            }}><Pencil className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => generateInvoiceMutation.mutate(f as any)} title="Generate Invoice">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <div className="flex items-center gap-4">
            <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-48" />
            <p className="text-sm text-muted-foreground">Period: {period.label}</p>
          </div>
          {invoices.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No invoices for this period.</CardContent></Card>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Freelancer</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.staff_profiles?.name ?? "—"}</TableCell>
                      <TableCell>{Number(inv.total_hours).toFixed(1)}</TableCell>
                      <TableCell>RM {Number(inv.hourly_rate).toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">RM {Number(inv.total_payable).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={inv.status === "paid" ? "default" : inv.status === "issued" ? "secondary" : "outline"}>{inv.status}</Badge></TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => downloadInvoice(inv)}><Download className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(o) => { if (!o) setEditDialogOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Freelancer</DialogTitle></DialogHeader>
          {editForm && (
            <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(editForm); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Full Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>IC/Passport</Label><Input value={editForm.ic_number} onChange={(e) => setEditForm({ ...editForm, ic_number: formatIcNumber(e.target.value) })} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone_number} onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })} /></div>
                <div className="space-y-2"><Label>Hourly Rate (RM)</Label><Input type="number" step="0.01" value={editForm.base_rate} onChange={(e) => setEditForm({ ...editForm, base_rate: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Bank Name</Label><Input value={editForm.bank_name} onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Bank Account No.</Label><Input value={editForm.bank_account_number} onChange={(e) => setEditForm({ ...editForm, bank_account_number: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={editForm.branch_id} onValueChange={(v) => setEditForm({ ...editForm, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Freelancers;
