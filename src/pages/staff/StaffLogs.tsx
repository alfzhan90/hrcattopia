import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, Filter, ClipboardList, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { getPayPeriod } from "@/lib/payroll";

const StaffLogs = () => {
  const { user } = useAuth();
  const currentPeriod = getPayPeriod(format(new Date(), "yyyy-MM"));
  const [startDate, setStartDate] = useState<Date>(currentPeriod.start);
  const [endDate, setEndDate] = useState<Date>(currentPeriod.end);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["my-logs", user?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user!.id)
        .gte("check_in_time", startDate.toISOString())
        .lte("check_in_time", new Date(endDate.getTime() + 86400000).toISOString())
        .order("check_in_time", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const totalNetHours = logs.reduce((s, l) => s + Number(l.net_hours), 0);
  const totalOtHours = logs.reduce((s, l) => s + Number(l.ot_hours), 0);
  const totalDays = logs.filter((l) => l.check_out_time).length;

  const statusBadge = (status: string, lateMinutes: number, waived: boolean) => {
    if (status === "late" && !waived)
      return <Badge variant="outline" className="text-[10px] tabular-nums bg-destructive/10 text-destructive border-destructive/20">Late ({lateMinutes}m)</Badge>;
    if (status === "late" && waived)
      return <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">Late (Waived)</Badge>;
    return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">On Time</Badge>;
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-4">
      <h1 className="text-xl font-bold">My Attendance Logs</h1>
      <p className="text-xs text-muted-foreground">Pay cycle: 24th prev month – 23rd current month</p>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" /> Filter by Date
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left text-sm h-11">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(startDate, "dd MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => d && setStartDate(d)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left text-sm h-11">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(endDate, "dd MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => d && setEndDate(d)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-xl" style={{ borderTop: "3px solid hsl(var(--primary) / 0.5)" }}>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-primary">{totalDays}</p>
            <p className="text-[10px] text-muted-foreground">Days Worked</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl" style={{ borderTop: "3px solid hsl(var(--primary) / 0.3)" }}>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold tabular-nums">{totalNetHours.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">Net Hours</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl" style={{ borderTop: "3px solid rgb(245 158 11 / 0.5)" }}>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-amber-600">{totalOtHours.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">OT Hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="rounded-xl">
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ClipboardList className="h-8 w-8 opacity-30" />
              <p className="text-sm font-medium">No records for this period.</p>
              <p className="text-xs">Try adjusting the date range above.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id} className="rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">
                    {format(parseISO(log.check_in_time), "EEE, dd MMM")}
                  </span>
                  {statusBadge(log.status, log.late_minutes, log.late_waived)}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(parseISO(log.check_in_time), "hh:mm a")}
                  </span>
                  <span>→</span>
                  <span>
                    {log.check_out_time
                      ? format(parseISO(log.check_out_time), "hh:mm a")
                      : "—"}
                  </span>
                  <span className="ml-auto font-medium text-foreground">
                    {Number(log.net_hours).toFixed(1)}h
                  </span>
                </div>
                {!log.check_out_time && (
                  <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" /> Missing clock out
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StaffLogs;
