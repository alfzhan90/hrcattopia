import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AttendanceLog = Tables<"attendance_logs">;

const LiveAttendance = () => {
  const today = new Date().toISOString().split("T")[0];

  // Fetch today's active check-ins (no check-out yet)
  const { data: activeLogs = [], isLoading } = useQuery({
    queryKey: ["live-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("*")
        .gte("check_in_time", today)
        .is("check_out_time", null)
        .order("check_in_time", { ascending: false });
      if (error) throw error;
      return data as AttendanceLog[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch staff profiles for names
  const { data: staffMap = {} } = useQuery({
    queryKey: ["staff-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("user_id, name, staff_id");
      if (error) throw error;
      const map: Record<string, { name: string; staff_id: string }> = {};
      data?.forEach((s) => { map[s.user_id] = { name: s.name, staff_id: s.staff_id }; });
      return map;
    },
  });

  // Fetch branches for distance calc
  const { data: branchMap = {} } = useQuery({
    queryKey: ["branch-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name, latitude, longitude");
      if (error) throw error;
      const map: Record<string, { name: string; latitude: number; longitude: number }> = {};
      data?.forEach((b) => { map[b.id] = b; });
      return map;
    },
  });

  const calcDistance = (log: AttendanceLog) => {
    const branch = branchMap[log.branch_id];
    if (!branch || !log.check_in_lat || !log.check_in_long) return null;
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(branch.latitude - log.check_in_lat);
    const dLon = toRad(branch.longitude - log.check_in_long);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(log.check_in_lat)) * Math.cos(toRad(branch.latitude)) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const getDuration = (checkInTime: string) => {
    const mins = Math.floor((Date.now() - new Date(checkInTime).getTime()) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Live Attendance</h1>
        <p className="text-muted-foreground">Staff currently checked in today. Refreshes every 30 seconds.</p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Check-in Time</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : activeLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No one is currently checked in.
                </TableCell>
              </TableRow>
            ) : (
              activeLogs.map((log) => {
                const staff = staffMap[log.user_id];
                const branch = branchMap[log.branch_id];
                const dist = calcDistance(log);

                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{staff?.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{staff?.staff_id ?? "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {new Date(log.check_in_time).toLocaleTimeString()}
                      </div>
                    </TableCell>
                    <TableCell>{getDuration(log.check_in_time)}</TableCell>
                    <TableCell>{branch?.name ?? "—"}</TableCell>
                    <TableCell>
                      {dist !== null ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {dist}m
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === "on_time" ? "default" : "destructive"}>
                        {log.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LiveAttendance;
