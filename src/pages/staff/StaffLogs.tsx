import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, Filter } from "lucide-react";
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
      return <Badge variant="destructive" className="text-[10px]">Late ({lateMinutes}m)</Badge>;
    if (status === "late" && waived)
      return <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">Late (Waived)</Badge>;
    return <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">On Time</Badge>;
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
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{totalDays}</p>
            <p className="text-[10px] text-muted-foreground">Days Worked</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{totalNetHours.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">Net Hours</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{totalOtHours.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">OT Hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No attendance records found for this period.</p>
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
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                  <p className="text-[10px] text-destructive mt-1">⚠️ Missing clock out</p>
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
