import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  staffProfileId: string;
  staffName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StaffAllowancesDialog({ staffProfileId, staffName, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const { data: allowances = [] } = useQuery({
    queryKey: ["staff-allowances", staffProfileId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("staff_allowances")
        .select("*")
        .eq("staff_profile_id", staffProfileId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("staff_allowances")
        .insert({ staff_profile_id: staffProfileId, name: newName.trim(), amount: parseFloat(newAmount) || 0 });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-allowances", staffProfileId] });
      setNewName("");
      setNewAmount("");
      toast({ title: "Allowance added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("staff_allowances")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["staff-allowances", staffProfileId] });
      toast({ title: vars.is_active ? "Allowance enabled" : "Allowance disabled" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("staff_allowances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-allowances", staffProfileId] });
      toast({ title: "Allowance removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalActive = allowances.filter((a: any) => a.is_active).reduce((sum: number, a: any) => sum + Number(a.amount), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Allowances — {staffName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {allowances.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Active total: <span className="font-semibold text-foreground">RM {totalActive.toFixed(2)}</span> / month
            </div>
          )}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {allowances.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No allowances set.</p>
            ) : (
              allowances.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between gap-2 p-2 rounded-md border">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{a.name}</span>
                    <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                      RM {Number(a.amount).toFixed(2)}
                    </span>
                    {!a.is_active && <Badge variant="secondary" className="text-[10px]">Off</Badge>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => toggleMutation.mutate({ id: a.id, is_active: !a.is_active })}
                      title={a.is_active ? "Disable" : "Enable"}
                    >
                      {a.is_active
                        ? <ToggleRight className="h-4 w-4 text-primary" />
                        : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-3 space-y-2">
            <Label className="text-sm font-medium">Add Allowance</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Transport"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                step="0.01"
                placeholder="RM"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-28"
              />
              <Button
                size="sm"
                onClick={() => addMutation.mutate()}
                disabled={!newName.trim() || !newAmount || addMutation.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
