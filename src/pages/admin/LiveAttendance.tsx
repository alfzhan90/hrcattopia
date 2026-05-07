import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

type AttendanceLog = Tables<"attendance_logs">;

const LiveAttendance = () => {
  // MYT (UTC+8) midnight as a UTC ISO timestamp. A bare date string compared
  // with .gte() is interpreted as UTC midnight, which wrongly excludes staff
  // who clocked in early morning MYT (UTC = previous day evening).
  const mytNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const mytMidnightUtcIso = new Date(Date.UTC(
    mytNow.getUTCFullYear(), mytNow.getUTCMonth(), mytNow.getUTCDate(), -8, 0, 0
  )).toISOString();

  // Fetch active check-ins (no check-out yet) — include any open session,
  // not just today's, so early-morning shifts are never hidden.
  const { data: activeLogs = [], isLoading } = useQuery({
    queryKey: ["live-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("*")
        .is("check_out_time", null)
        .gte("check_in_time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Attendance</h1>
          <p className="text-muted-foreground">Staff currently checked in. Refreshes every 30 seconds.</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {activeLogs.length} Live
        </div>
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
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : activeLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="h-8 w-8 opacity-30" />
                    <p className="font-medium">No one is currently checked in.</p>
                    <p className="text-sm">Staff will appear here once they clock in.</p>
                  </div>
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
                      <div className="flex items-center gap-1 tabular-nums">
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                        {new Date(log.check_in_time).toLocaleTimeString()}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums font-medium">{getDuration(log.check_in_time)}</TableCell>
                    <TableCell>{branch?.name ?? "—"}</TableCell>
                    <TableCell>
                      {dist !== null ? (
                        <div className="flex items-center gap-1 tabular-nums text-sm">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {dist}m
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={log.status === "on_time"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                      } variant="outline">
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
