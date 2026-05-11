import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, ShieldAlert, ClipboardList, Plus, Trash2, Check, X, Search } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

type StaffProfile = Tables<"staff_profiles">;

const DEFAULT_ONBOARDING_TASKS = [
  "IC / Passport copy submitted",
  "Employment contract signed",
  "Bank account details collected",
  "EPF (KWSP) number registered",
  "SOCSO number registered",
  "Emergency contact obtained",
  "Company email setup",
  "System access granted",
  "Orientation completed",
  "Uniform / equipment issued",
];

const DISCIPLINARY_TYPES: Record<string, { label: string; color: string }> = {
  verbal_warning:  { label: "Verbal Warning",  color: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  written_warning: { label: "Written Warning", color: "bg-orange-500/10 text-orange-700 border-orange-500/30" },
  show_cause:      { label: "Show-Cause",      color: "bg-red-500/10 text-red-700 border-red-500/30" },
  suspension:      { label: "Suspension",      color: "bg-destructive/10 text-destructive border-destructive/30" },
  final_warning:   { label: "Final Warning",   color: "bg-destructive/10 text-destructive border-destructive/30" },
};

// ─── Announcements ───────────────────────────────────────────────────────────
const AnnouncementsTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("announcements").insert({
        title: title.trim(), body: body.trim(),
        expires_at: expiresAt || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements-admin"] });
      qc.invalidateQueries({ queryKey: ["announcements-staff"] });
      setTitle(""); setBody(""); setExpiresAt("");
      toast({ title: "Announcement posted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from("announcements").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements-admin"] }); qc.invalidateQueries({ queryKey: ["announcements-staff"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements-admin"] }); qc.invalidateQueries({ queryKey: ["announcements-staff"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">New Announcement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input placeholder="e.g. Public Holiday Notice" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea rows={3} placeholder="Announcement details..." value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Expiry Date (optional)</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-48" />
          </div>
          <Button onClick={() => addMutation.mutate()} disabled={!title.trim() || !body.trim() || addMutation.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Post Announcement
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />) :
         announcements.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No announcements yet.</p> :
         announcements.map((a: any) => (
          <Card key={a.id} className={!a.is_active ? "opacity-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{a.title}</p>
                    <Badge variant={a.is_active ? "default" : "secondary"} className="text-[10px]">
                      {a.is_active ? "Active" : "Hidden"}
                    </Badge>
                    {a.expires_at && <Badge variant="outline" className="text-[10px]">Expires {a.expires_at}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(a.created_at), "dd MMM yyyy")}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                    onClick={() => toggleMutation.mutate({ id: a.id, is_active: !a.is_active })}>
                    {a.is_active ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                    onClick={() => deleteMutation.mutate(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── Disciplinary Records ─────────────────────────────────────────────────────
const DisciplinaryTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [issuedDate, setIssuedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-hr"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("id, name, staff_id").order("name");
      if (error) throw error;
      return data as Pick<StaffProfile, "id" | "name" | "staff_id">[];
    },
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["disciplinary-records"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("disciplinary_records")
        .select("*, staff_profiles(name, staff_id)")
        .order("issued_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("disciplinary_records").insert({
        staff_profile_id: selectedStaffId, type, description: description.trim(),
        issued_date: issuedDate, issued_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disciplinary-records"] });
      setSelectedStaffId(""); setType(""); setDescription(""); setIssuedDate(format(new Date(), "yyyy-MM-dd"));
      toast({ title: "Record added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("disciplinary_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disciplinary-records"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = search
    ? records.filter((r: any) =>
        r.staff_profiles?.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.staff_profiles?.staff_id?.toLowerCase().includes(search.toLowerCase()))
    : records;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Add Disciplinary Record</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Staff Member</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.staff_id})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DISCIPLINARY_TYPES).map(([v, { label }]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description / Incident Details</Label>
            <Textarea rows={3} placeholder="Describe the incident and action taken..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Date Issued</Label>
            <Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} className="w-48" />
          </div>
          <Button onClick={() => addMutation.mutate()} disabled={!selectedStaffId || !type || !description.trim() || addMutation.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Add Record
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              )) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No records found.</TableCell></TableRow>
              ) : filtered.map((r: any) => {
                const dt = DISCIPLINARY_TYPES[r.type];
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{r.staff_profiles?.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.staff_profiles?.staff_id}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${dt?.color}`}>{dt?.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{r.issued_date}</TableCell>
                    <TableCell className="text-sm max-w-[240px] truncate">{r.description}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

// ─── Onboarding Checklists ────────────────────────────────────────────────────
const OnboardingTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-onboarding"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("id, name, staff_id").order("name");
      if (error) throw error;
      return data as Pick<StaffProfile, "id" | "name" | "staff_id">[];
    },
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["onboarding-tasks", selectedStaffId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("onboarding_tasks")
        .select("*")
        .eq("staff_profile_id", selectedStaffId)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedStaffId,
  });

  const { data: allProgress = [] } = useQuery({
    queryKey: ["onboarding-progress"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("onboarding_tasks")
        .select("staff_profile_id, completed");
      if (error) throw error;
      return data ?? [];
    },
  });

  const progressMap: Record<string, { done: number; total: number }> = {};
  for (const t of allProgress) {
    if (!progressMap[t.staff_profile_id]) progressMap[t.staff_profile_id] = { done: 0, total: 0 };
    progressMap[t.staff_profile_id].total++;
    if (t.completed) progressMap[t.staff_profile_id].done++;
  }

  const generateMutation = useMutation({
    mutationFn: async () => {
      const insertRows = DEFAULT_ONBOARDING_TASKS.map((task_name, i) => ({
        staff_profile_id: selectedStaffId, task_name, sort_order: i,
      }));
      const { error } = await (supabase as any).from("onboarding_tasks").insert(insertRows);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["onboarding-tasks", selectedStaffId] }); qc.invalidateQueries({ queryKey: ["onboarding-progress"] }); toast({ title: "Checklist generated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await (supabase as any).from("onboarding_tasks").update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? user!.id : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["onboarding-tasks", selectedStaffId] }); qc.invalidateQueries({ queryKey: ["onboarding-progress"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const selectedStaff = staff.find((s) => s.id === selectedStaffId);
  const completedCount = tasks.filter((t: any) => t.completed).length;
  const pct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {staff.map((s) => {
          const prog = progressMap[s.id];
          const hasTasks = prog && prog.total > 0;
          const pctDone = hasTasks ? Math.round((prog.done / prog.total) * 100) : null;
          return (
            <button
              key={s.id}
              onClick={() => { setSelectedStaffId(s.id); setDialogOpen(true); }}
              className={`text-left p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${selectedStaffId === s.id ? "border-primary/50 bg-primary/5" : ""}`}
            >
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{s.staff_id}</p>
              {hasTasks ? (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pctDone}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{prog.done}/{prog.total} tasks — {pctDone}%</p>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-1">No checklist yet</p>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Onboarding — {selectedStaff?.name}</DialogTitle>
          </DialogHeader>
          {isLoading ? <Skeleton className="h-40 w-full" /> : tasks.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No checklist generated yet.</p>
              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                <ClipboardList className="h-4 w-4 mr-1.5" /> Generate Default Checklist
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{completedCount}/{tasks.length} completed</span>
                <Badge className={pct === 100 ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-primary/10 text-primary border-primary/30"}>
                  {pct}%
                </Badge>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {tasks.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => toggleTaskMutation.mutate({ id: t.id, completed: !t.completed })}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${t.completed ? "bg-emerald-500/5 border-emerald-500/20" : "hover:bg-muted/50"}`}
                  >
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${t.completed ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40"}`}>
                      {t.completed && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className={`text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.task_name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Main HR Page ─────────────────────────────────────────────────────────────
const HR = () => (
  <div className="p-6 space-y-6">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">HR Management</h1>
      <p className="text-muted-foreground">Announcements, disciplinary records, and staff onboarding.</p>
    </div>
    <Tabs defaultValue="announcements">
      <TabsList>
        <TabsTrigger value="announcements" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Announcements</TabsTrigger>
        <TabsTrigger value="disciplinary" className="gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Disciplinary</TabsTrigger>
        <TabsTrigger value="onboarding" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Onboarding</TabsTrigger>
      </TabsList>
      <TabsContent value="announcements" className="mt-4"><AnnouncementsTab /></TabsContent>
      <TabsContent value="disciplinary" className="mt-4"><DisciplinaryTab /></TabsContent>
      <TabsContent value="onboarding" className="mt-4"><OnboardingTab /></TabsContent>
    </Tabs>
  </div>
);

export default HR;
