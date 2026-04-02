import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

const HolidayCalendar = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", multiplier: "2.0" });

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["public-holidays"],
    queryFn: async () => {
      const { data, error } = await supabase.from("public_holidays").select("*").order("date");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const { error } = await supabase.from("public_holidays").insert({
        name: f.name,
        date: f.date,
        multiplier: parseFloat(f.multiplier),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-holidays"] });
      toast({ title: "Holiday added" });
      setAddOpen(false);
      setForm({ name: "", date: "", multiplier: "2.0" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("public_holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-holidays"] });
      toast({ title: "Holiday removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Public Holiday Calendar</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Holiday
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Holiday Name</TableHead>
              <TableHead>Pay Multiplier</TableHead>
              <TableHead className="w-16">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : holidays.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No holidays added.</TableCell></TableRow>
            ) : (
              holidays.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell>{h.date}</TableCell>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>{h.multiplier}x</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(h.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Public Holiday</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Holiday Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Hari Raya Aidilfitri" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Pay Multiplier</Label>
              <Select value={form.multiplier} onValueChange={(v) => setForm({ ...form, multiplier: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2.0">2.0x (Double)</SelectItem>
                  <SelectItem value="3.0">3.0x (Triple)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={() => addMutation.mutate(form)} disabled={addMutation.isPending || !form.name || !form.date}>
                {addMutation.isPending ? "Adding..." : "Add Holiday"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HolidayCalendar;
