import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, Building2 } from "lucide-react";

const CompanySettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    company_name: "",
    ssm_number: "",
    address: "",
    phone: "",
    logo_url: "",
  });

  // Sync form when settings load
  const [synced, setSynced] = useState(false);
  if (settings && !synced) {
    setForm({
      company_name: settings.company_name || "",
      ssm_number: settings.ssm_number || "",
      address: settings.address || "",
      phone: settings.phone || "",
      logo_url: settings.logo_url || "",
    });
    setSynced(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_name: form.company_name,
        ssm_number: form.ssm_number,
        address: form.address,
        phone: form.phone,
        logo_url: form.logo_url || null,
      };
      if (settings?.id) {
        const { error } = await supabase
          .from("company_settings")
          .update(payload)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_settings")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast({ title: "Saved", description: "Company settings updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logo.${ext}`;
      // Remove old logo if exists
      await supabase.storage.from("company-assets").remove([path]);
      const { error: uploadErr } = await supabase.storage
        .from("company-assets")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage
        .from("company-assets")
        .getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: urlData.publicUrl }));
      toast({ title: "Logo uploaded", description: "Remember to click Save." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
        <p className="text-muted-foreground">Manage company details and branding.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">General Information</CardTitle>
            <CardDescription>These details appear on payslips and official documents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder="e.g. CatTopia Sdn Bhd"
              />
            </div>
            <div className="space-y-2">
              <Label>SSM Registration Number</Label>
              <Input
                value={form.ssm_number}
                onChange={(e) => setForm((f) => ({ ...f, ssm_number: e.target.value }))}
                placeholder="e.g. 202301012345"
              />
            </div>
            <div className="space-y-2">
              <Label>Official Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="e.g. No. 1, Jalan Kucing, 50000 KL"
              />
            </div>
            <div className="space-y-2">
              <Label>Admin/HR Phone Number</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. 03-12345678"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Company Logo</CardTitle>
            <CardDescription>Upload a logo to display on payslips, login screen, and sidebar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.logo_url ? (
              <div className="flex flex-col items-center gap-4">
                <img
                  src={form.logo_url}
                  alt="Company Logo"
                  className="h-24 w-auto object-contain rounded border p-2"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}
                >
                  Remove Logo
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8 border-2 border-dashed rounded-lg">
                <Building2 className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No logo uploaded yet</p>
              </div>
            )}
            <div>
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      {uploading ? "Uploading..." : "Upload Logo"}
                    </span>
                  </Button>
                </div>
              </Label>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        <Save className="h-4 w-4 mr-2" />
        {saveMutation.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
};

export default CompanySettings;
