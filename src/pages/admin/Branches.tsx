import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePersistentForm } from "@/hooks/use-persistent-form";
import { Plus, Pencil, Trash2, MapPin, Save } from "lucide-react";
import BranchMap from "@/components/BranchMap";
import type { Tables } from "@/integrations/supabase/types";

type Branch = Tables<"branches">;

const defaultBranchForm = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radius_meters: "100",
};

const Branches = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const { form, setForm, hasDraft, clearDraft } = usePersistentForm("branch_form", defaultBranchForm);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const lat = parseFloat(values.latitude);
      const lng = parseFloat(values.longitude);
      const radius = parseInt(values.radius_meters);

      if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
        throw new Error("Invalid coordinates or radius. Please enter valid numbers.");
      }

      const payload = {
        name: values.name,
        address: values.address,
        latitude: lat,
        longitude: lng,
        radius_meters: radius,
      };

      if (editingBranch) {
        const { data, error } = await supabase
          .from("branches")
          .update(payload)
          .eq("id", editingBranch.id)
          .select();
        if (error) throw new Error(`Update failed: ${error.message} (${error.code})`);
        if (!data || data.length === 0) throw new Error("Update failed: No rows affected. Check permissions.");
      } else {
        const { data, error } = await supabase.from("branches").insert(payload).select();
        if (error) throw new Error(`Insert failed: ${error.message} (${error.code})`);
        if (!data || data.length === 0) throw new Error("Insert failed: No rows returned. Check RLS policies.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast({ title: editingBranch ? "Branch updated" : "Branch created" });
      closeDialog(true);
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "An unknown error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast({ title: "Branch deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const closeDialog = (clearForm = false) => {
    setDialogOpen(false);
    setEditingBranch(null);
    if (clearForm) clearDraft();
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      address: branch.address,
      latitude: String(branch.latitude),
      longitude: String(branch.longitude),
      radius_meters: String(branch.radius_meters),
    });
    setDialogOpen(true);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setForm((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
    if (!dialogOpen) setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branch Management</h1>
          <p className="text-muted-foreground">Manage your company branches and geofence areas.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Branch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBranch ? "Edit Branch" : "Add New Branch"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Branch Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. KL HQ"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. Jalan Bukit Bintang, KL"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    placeholder="3.1478"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    placeholder="101.7102"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Geofence Radius (meters)</Label>
                <Input
                  type="number"
                  value={form.radius_meters}
                  onChange={(e) => setForm({ ...form, radius_meters: e.target.value })}
                  placeholder="100"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                <MapPin className="inline h-3 w-3 mr-1" />
                Tip: Click on the map to set coordinates automatically.
              </p>
              <div className="flex items-center gap-2 justify-end">
                {hasDraft && !editingBranch && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mr-auto">
                    <Save className="h-3 w-3" />
                    Draft saved
                  </span>
                )}
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editingBranch ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Map */}
      <div className="rounded-lg border overflow-hidden" style={{ height: 400 }}>
        <BranchMap
          branches={branches}
          onMapClick={handleMapClick}
          pendingLocation={
            form.latitude && form.longitude && !editingBranch
              ? { lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }
              : null
          }
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Lat / Lng</TableHead>
              <TableHead>Radius</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No branches yet. Click "Add Branch" or click on the map to get started.
                </TableCell>
              </TableRow>
            ) : (
              branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>{branch.address}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {branch.latitude.toFixed(4)}, {branch.longitude.toFixed(4)}
                  </TableCell>
                  <TableCell>{branch.radius_meters}m</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(branch)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(branch.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Branches;
