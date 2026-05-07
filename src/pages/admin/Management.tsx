import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GoogleMap, useJsApiLoader, Marker, Circle } from "@react-google-maps/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Clock, MapPin, Users, Search, X, Car } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AttendanceLog = Tables<"attendance_logs">;
type Branch = Tables<"branches">;

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyCVQTyrQN4Dz07qZxHSV7QSF-riz2kDJMM";
const mapContainerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: 3.139, lng: 101.6869 };

const Management = () => {
  // MYT (UTC+8) "today" — compute the MYT calendar date and the UTC instant
  // corresponding to MYT 00:00. Using a bare date string with .gte() compares
  // against UTC midnight, which incorrectly excludes records check-in early
  // morning MYT (UTC previous day evening).
  const mytNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const today = `${mytNow.getUTCFullYear()}-${String(mytNow.getUTCMonth() + 1).padStart(2, "0")}-${String(mytNow.getUTCDate()).padStart(2, "0")}`;
  // MYT midnight today, expressed as a real UTC ISO timestamp
  const mytMidnightUtcIso = new Date(Date.UTC(
    mytNow.getUTCFullYear(), mytNow.getUTCMonth(), mytNow.getUTCDate(), -8, 0, 0
  )).toISOString();
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });

  // Today's logs
  const { data: todayLogs = [], refetch: refetchLogs, isRefetching } = useQuery({
    queryKey: ["mgmt-logs", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("*")
        .gte("check_in_time", mytMidnightUtcIso)
        .order("check_in_time", { ascending: false });
      if (error) throw error;
      return data as AttendanceLog[];
    },
    refetchInterval: 30000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["mgmt-branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const { data: staffMap = {} } = useQuery({
    queryKey: ["mgmt-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("user_id, name, staff_id, branch_id, employment_type, freelancer_ot_enabled");
      if (error) throw error;
      const map: Record<string, { name: string; staff_id: string; branch_id: string | null; employment_type: string; freelancer_ot_enabled?: boolean }> = {};
      data?.forEach((s) => { map[s.user_id] = s as any; });
      return map;
    },
  });

  // Holidays for today
  const { data: todayHoliday } = useQuery({
    queryKey: ["mgmt-holiday-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_holidays").select("name, multiplier")
        .eq("date", today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Today's branch visits (Area Managers)
  const { data: todayVisits = [] } = useQuery({
    queryKey: ["mgmt-visits", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_visits")
        .select("*, staff_profiles(user_id, name, staff_id), branches(name)")
        .gte("visited_at", mytMidnightUtcIso)
        .order("visited_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Derived data
  const activeLogs = useMemo(() => todayLogs.filter((l) => !l.check_out_time), [todayLogs]);
  const completedLogs = useMemo(() => todayLogs.filter((l) => l.check_out_time), [todayLogs]);

  const branchActiveCounts = useMemo(() => {
    const counts: Record<string, AttendanceLog[]> = {};
    activeLogs.forEach((l) => {
      if (!counts[l.branch_id]) counts[l.branch_id] = [];
      counts[l.branch_id].push(l);
    });
    return counts;
  }, [activeLogs]);

  const branchCompletedLogs = useMemo(() => {
    const counts: Record<string, AttendanceLog[]> = {};
    completedLogs.forEach((l) => {
      if (!counts[l.branch_id]) counts[l.branch_id] = [];
      counts[l.branch_id].push(l);
    });
    return counts;
  }, [completedLogs]);

  const branchAssignedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(staffMap).forEach((s) => {
      if (s.branch_id) counts[s.branch_id] = (counts[s.branch_id] || 0) + 1;
    });
    return counts;
  }, [staffMap]);

  const filteredActiveStaff = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return activeLogs.filter((l) => {
      const s = staffMap[l.user_id];
      if (!s) return false;
      return s.name.toLowerCase().includes(q) || s.staff_id.toLowerCase().includes(q);
    });
  }, [activeLogs, staffMap, searchQuery]);

  const selectedBranchData = branches.find((b) => b.id === selectedBranch);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Management</h1>
          <p className="text-muted-foreground">
            Real-time overview — {activeLogs.length} staff currently working
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchLogs()} disabled={isRefetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Map + Selected Branch Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-[400px] rounded-lg border overflow-hidden">
          {!GOOGLE_MAPS_API_KEY ? (
            <div className="flex items-center justify-center h-full bg-muted text-muted-foreground text-sm">
              <p>Set <code className="bg-accent px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to enable map.</p>
            </div>
          ) : !isLoaded ? (
            <div className="flex items-center justify-center h-full bg-muted">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={branches.length > 0 ? { lat: branches[0].latitude, lng: branches[0].longitude } : defaultCenter}
              zoom={12}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                styles: [
                  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
                  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
                  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
                  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a3e" }] },
                  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e0e1a" }] },
                  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
                ],
              }}
            >
              {branches.map((branch) => {
                const count = branchActiveCounts[branch.id]?.length || 0;
                return (
                  <div key={branch.id}>
                    <Marker
                      position={{ lat: branch.latitude, lng: branch.longitude }}
                      title={`${branch.name} (${count} in)`}
                      label={count > 0 ? { text: String(count), color: "white", fontWeight: "bold" } : undefined}
                      onClick={() => setSelectedBranch(branch.id)}
                    />
                    <Circle
                      center={{ lat: branch.latitude, lng: branch.longitude }}
                      radius={branch.radius_meters}
                      options={{
                        fillColor: count > 0 ? "#22c55e" : "#94a3b8",
                        fillOpacity: 0.15,
                        strokeColor: count > 0 ? "#22c55e" : "#94a3b8",
                        strokeOpacity: 0.4,
                        strokeWeight: 2,
                      }}
                    />
                  </div>
                );
              })}
            </GoogleMap>
          )}
        </div>

        {/* Selected Branch Panel */}
        <Card className="h-[400px] overflow-auto">
          {selectedBranchData ? (
            <>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{selectedBranchData.name}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedBranch(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {selectedBranchData.address}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Badge>{branchActiveCounts[selectedBranchData.id]?.length || 0} In</Badge>
                  <Badge variant="secondary">{branchCompletedLogs[selectedBranchData.id]?.length || 0} Out</Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Currently Working</p>
                  {(branchActiveCounts[selectedBranchData.id] || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No one clocked in</p>
                  ) : (
                    (branchActiveCounts[selectedBranchData.id] || []).map((log) => {
                      const s = staffMap[log.user_id];
                      return (
                        <div key={log.id} className="flex items-center justify-between text-sm border-b pb-1">
                          <div>
                            <p className="font-medium">{s?.name ?? "Unknown"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{s?.staff_id}</p>
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(log.check_in_time).toLocaleTimeString()}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <div className="text-center">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Click a branch marker on the map</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Branch Cards Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Branch Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {branches.map((branch) => {
            const activeInBranch = branchActiveCounts[branch.id] || [];
            const completedInBranch = branchCompletedLogs[branch.id] || [];
            const assigned = branchAssignedCounts[branch.id] || 0;
            return (
              <Card key={branch.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedBranch(branch.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{branch.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-3">
                    <Badge variant="default">
                      <Users className="h-3 w-3 mr-1" /> {activeInBranch.length} In
                    </Badge>
                    <Badge variant="secondary">{completedInBranch.length} Out</Badge>
                    <Badge variant="outline">Assigned: {assigned}</Badge>
                  </div>
                  <div className="space-y-1">
                    {activeInBranch.slice(0, 3).map((log) => {
                      const s = staffMap[log.user_id];
                      return (
                        <p key={log.id} className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          {s?.name ?? "Unknown"} — {new Date(log.check_in_time).toLocaleTimeString()}
                        </p>
                      );
                    })}
                    {activeInBranch.length > 3 && (
                      <p className="text-xs text-muted-foreground">+{activeInBranch.length - 3} more</p>
                    )}
                    {activeInBranch.length === 0 && (
                      <p className="text-xs text-muted-foreground">No one working</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Global Who's Working Now */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Who's Working Now</h2>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="rounded-lg border">
          <div className="divide-y max-h-[400px] overflow-auto">
            {filteredActiveStaff.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No staff currently clocked in.</div>
            ) : (
              filteredActiveStaff.map((log) => {
                const s = staffMap[log.user_id];
                const branch = branches.find((b) => b.id === log.branch_id);
                const mins = Math.floor((Date.now() - new Date(log.check_in_time).getTime()) / 60000);
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                const duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
                return (
                  <div key={log.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm">{s?.name ?? "Unknown"}</p>
                          {s?.employment_type === "Area-Manager" && <Car className="h-3 w-3 text-amber-500" />}
                          {s?.employment_type === "Freelancer" && <span className="h-3 w-3 rounded-full bg-orange-400 inline-block" />}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{s?.staff_id}</p>
                        {s?.employment_type === "Freelancer" && (
                          <p className="text-[10px] text-orange-500 font-medium">
                            {todayHoliday ? `${todayHoliday.multiplier}x Holiday Rate` : s.freelancer_ot_enabled ? "OT Enabled (1.5x >8hrs)" : "Standard Rate"}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{branch?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {new Date(log.check_in_time).toLocaleTimeString()} · {duration}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Area Manager Travel Summary */}
      {todayVisits.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Car className="h-5 w-5 text-amber-500" /> Area Manager Visits Today
          </h2>
          <div className="rounded-lg border">
            <div className="divide-y max-h-[300px] overflow-auto">
              {todayVisits.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-medium text-sm">{v.staff_profiles?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">→ {v.branches?.name ?? "Unknown"}</p>
                  </div>
                  <div className="text-right">
                    {Number(v.distance_from_previous_km) > 0 && (
                      <p className="text-xs font-medium">{Number(v.distance_from_previous_km).toFixed(1)} km</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.visited_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;
