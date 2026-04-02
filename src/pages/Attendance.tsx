import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { LogIn, LogOut, MapPin, ShieldAlert, Clock } from "lucide-react";
import { GoogleMap, useJsApiLoader, Circle, Marker } from "@react-google-maps/api";
import { haversineDistance, generateDeviceFingerprint, getCurrentPosition } from "@/lib/geo";
import type { Tables } from "@/integrations/supabase/types";

type StaffProfile = Tables<"staff_profiles">;
type Branch = Tables<"branches">;

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const Attendance = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [geoError, setGeoError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [resolvedDeviceId, setResolvedDeviceId] = useState<string | null>(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as StaffProfile | null;
    },
    enabled: !!user,
  });

  const { data: branch } = useQuery({
    queryKey: ["my-branch", profile?.branch_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("id", profile!.branch_id!)
        .single();
      if (error) throw error;
      return data as Branch;
    },
    enabled: !!profile?.branch_id,
  });

  const { data: activeLog } = useQuery({
    queryKey: ["active-attendance", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user!.id)
        .gte("check_in_time", today)
        .is("check_out_time", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    setResolvedDeviceId(profile?.device_id ?? null);
  }, [profile?.device_id]);

  const bindDeviceMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be signed in to register this device.");
      if (!profile) throw new Error("Staff profile not found.");
      if (profile.user_id !== user.id) throw new Error("This staff profile is linked to a different account.");

      const fingerprint = generateDeviceFingerprint();
      const { error } = await supabase
        .from("staff_profiles")
        .update({ device_id: fingerprint })
        .eq("id", profile.id)
        .eq("user_id", user.id);

      if (error) throw new Error(`Unable to save this device: ${error.message}`);
      return fingerprint;
    },
    onSuccess: (fingerprint) => {
      setResolvedDeviceId(fingerprint);
      setDeviceError(null);
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    },
    onError: (err: Error) => {
      setDeviceError(err.message);
      toast({
        title: "Device binding failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const { mutate: bindDevice, isPending: isBindingDevice } = bindDeviceMutation;

  useEffect(() => {
    if (!user || !profile) return;
    if (profile.user_id !== user.id) return;
    if (profile.device_id || resolvedDeviceId || isBindingDevice) return;

    bindDevice();
  }, [bindDevice, isBindingDevice, profile, resolvedDeviceId, user]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (branch) {
          setDistance(haversineDistance(pos.coords.latitude, pos.coords.longitude, branch.latitude, branch.longitude));
        }
      },
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [branch]);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      setGeoError(null);
      setDeviceError(null);

      if (!profile) throw new Error("Staff profile not found.");
      if (!profile.branch_id || !branch) throw new Error("No branch assigned.");

      const fingerprint = generateDeviceFingerprint();
      const currentDeviceId = resolvedDeviceId ?? profile.device_id;

      if (currentDeviceId && currentDeviceId !== fingerprint) {
        setDeviceError("Security Error: This account is locked to another device. Please contact Admin.");
        throw new Error("Device mismatch");
      }

      if (!currentDeviceId) {
        const { error: deviceSaveError } = await supabase
          .from("staff_profiles")
          .update({ device_id: fingerprint })
          .eq("id", profile.id)
          .eq("user_id", user!.id);

        if (deviceSaveError) {
          throw new Error(`Device binding failed: ${deviceSaveError.message}`);
        }

        setResolvedDeviceId(fingerprint);
      }

      const pos = await getCurrentPosition();
      const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, branch.latitude, branch.longitude);

      if (dist > branch.radius_meters) {
        setGeoError(`You are ${Math.round(dist)} meters away. Please move closer to ${branch.name}.`);
        throw new Error("Out of range");
      }

      const status = dist <= branch.radius_meters ? "on_time" : "out_of_range";

      const { error } = await supabase.from("attendance_logs").insert({
        user_id: user!.id,
        branch_id: branch.id,
        check_in_lat: pos.coords.latitude,
        check_in_long: pos.coords.longitude,
        status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-attendance", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      toast({ title: "Checked In!", description: "Your attendance has been recorded." });
    },
    onError: (err: Error) => {
      if (err.message !== "Device mismatch" && err.message !== "Out of range") {
        toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
      }
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!activeLog) throw new Error("No active check-in found.");

      const checkIn = new Date(activeLog.check_in_time);
      const now = new Date();
      const totalHours = (now.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      
      // Rest deduction: 1 hour per 5 hours worked
      const restHours = Math.floor(totalHours / 5);
      const netHours = Math.max(totalHours - restHours, 0);
      const regularHours = Math.min(netHours, 8);
      const otHours = Math.max(netHours - 8, 0);

      const { error } = await supabase
        .from("attendance_logs")
        .update({
          check_out_time: now.toISOString(),
          rest_hours: Math.round(restHours * 100) / 100,
          net_hours: Math.round(netHours * 100) / 100,
          regular_hours: Math.round(regularHours * 100) / 100,
          ot_hours: Math.round(otHours * 100) / 100,
        })
        .eq("id", activeLog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-attendance", user?.id] });
      toast({ title: "Checked Out!", description: "Have a great rest of the day." });
    },
    onError: (err: Error) => {
      toast({ title: "Check-out failed", description: err.message, variant: "destructive" });
    },
  });

  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>No Staff Profile</AlertTitle>
          <AlertDescription>Your account does not have a staff profile. Please contact your administrator.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const mapCenter = branch
    ? { lat: branch.latitude, lng: branch.longitude }
    : userPos ?? { lat: 3.139, lng: 101.6869 };

  return (
    <div className="min-h-screen bg-muted/50 p-4 max-w-lg mx-auto space-y-4">
      <div className="text-center pt-4">
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground text-sm">{profile.name} • {profile.staff_id}</p>
        {branch && <p className="text-xs text-muted-foreground mt-1">{branch.name}</p>}
      </div>

      {GOOGLE_MAPS_API_KEY && isLoaded && branch && (
        <div className="rounded-lg border overflow-hidden" style={{ height: 250 }}>
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={mapCenter}
            zoom={16}
            options={{ streetViewControl: false, mapTypeControl: false, zoomControl: false, fullscreenControl: false }}
          >
            <Circle
              center={{ lat: branch.latitude, lng: branch.longitude }}
              radius={branch.radius_meters}
              options={{
                fillColor: "hsl(222.2, 47.4%, 11.2%)",
                fillOpacity: 0.12,
                strokeColor: "hsl(222.2, 47.4%, 11.2%)",
                strokeOpacity: 0.4,
                strokeWeight: 2,
              }}
            />
            <Marker position={{ lat: branch.latitude, lng: branch.longitude }} title={branch.name} />
            {userPos && (
              <Marker
                position={userPos}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: "#3B82F6",
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 2,
                }}
                title="Your location"
              />
            )}
          </GoogleMap>
        </div>
      )}

      {distance !== null && branch && (
        <div className={`text-center text-sm font-medium ${distance <= branch.radius_meters ? "text-green-600" : "text-destructive"}`}>
          <MapPin className="inline h-4 w-4 mr-1" />
          {Math.round(distance)}m from {branch.name}
          {distance <= branch.radius_meters ? " ✓ In range" : " ✗ Out of range"}
        </div>
      )}

      {isBindingDevice && (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Securing this device for future attendance check-ins...
          </CardContent>
        </Card>
      )}

      {geoError && (
        <Alert variant="destructive">
          <MapPin className="h-4 w-4" />
          <AlertTitle>Out of Range</AlertTitle>
          <AlertDescription>{geoError}</AlertDescription>
        </Alert>
      )}
      {deviceError && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Device Locked</AlertTitle>
          <AlertDescription>{deviceError}</AlertDescription>
        </Alert>
      )}

      {activeLog && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Checked in at {new Date(activeLog.check_in_time).toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 pt-4">
        <Button
          size="lg"
          className="h-20 text-lg"
          disabled={!!activeLog || checkInMutation.isPending || isBindingDevice}
          onClick={() => checkInMutation.mutate()}
        >
          <LogIn className="h-6 w-6 mr-2" />
          {checkInMutation.isPending ? "Checking..." : isBindingDevice ? "Securing..." : "Check In"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-20 text-lg"
          disabled={!activeLog || checkOutMutation.isPending}
          onClick={() => checkOutMutation.mutate()}
        >
          <LogOut className="h-6 w-6 mr-2" />
          {checkOutMutation.isPending ? "Checking..." : "Check Out"}
        </Button>
      </div>
    </div>
  );
};

export default Attendance;
