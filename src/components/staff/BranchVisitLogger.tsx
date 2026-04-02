import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Navigation, Clock } from "lucide-react";
import { getCurrentPosition, haversineDistance } from "@/lib/geo";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Branch = Tables<"branches">;

interface Props {
  profileId: string;
}

const BranchVisitLogger = ({ profileId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState("");

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-visit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const today = new Date().toISOString().split("T")[0];

  const { data: todayVisits = [] } = useQuery({
    queryKey: ["today-visits", profileId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_visits")
        .select("*, branches(name)")
        .eq("staff_profile_id", profileId)
        .gte("visited_at", today)
        .order("visited_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const totalKm = todayVisits.reduce((sum: number, v: any) => sum + Number(v.distance_from_previous_km), 0);

  const logVisitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBranch) throw new Error("Select a branch");
      const branch = branches.find((b) => b.id === selectedBranch);
      if (!branch) throw new Error("Branch not found");

      const pos = await getCurrentPosition();
      const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, branch.latitude, branch.longitude);

      if (dist > branch.radius_meters * 3) {
        throw new Error(`You are ${Math.round(dist)}m away from ${branch.name}. Please be closer to log a visit.`);
      }

      // Calculate distance from previous visit
      let distanceKm = 0;
      if (todayVisits.length > 0) {
        const lastVisit = todayVisits[todayVisits.length - 1];
        if (lastVisit.check_in_lat && lastVisit.check_in_long) {
          distanceKm = haversineDistance(
            lastVisit.check_in_lat, lastVisit.check_in_long,
            pos.coords.latitude, pos.coords.longitude
          ) / 1000;
        }
      }

      const { error } = await supabase.from("branch_visits").insert({
        staff_profile_id: profileId,
        branch_id: selectedBranch,
        check_in_lat: pos.coords.latitude,
        check_in_long: pos.coords.longitude,
        distance_from_previous_km: Math.round(distanceKm * 10) / 10,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today-visits"] });
      toast({ title: "Visit logged!", description: "Branch visit has been recorded." });
      setSelectedBranch("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Navigation className="h-4 w-4" />
          Branch Visits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select branch to visit" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => logVisitMutation.mutate()}
            disabled={!selectedBranch || logVisitMutation.isPending}
            size="sm"
          >
            <MapPin className="h-4 w-4 mr-1" />
            {logVisitMutation.isPending ? "..." : "Log Visit"}
          </Button>
        </div>

        {todayVisits.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase">Today's Visits</p>
              <Badge variant="secondary" className="text-xs">
                {todayVisits.length} branches · {totalKm.toFixed(1)} km
              </Badge>
            </div>
            <div className="space-y-1">
              {todayVisits.map((v: any, i: number) => (
                <div key={v.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                    <span className="font-medium">{v.branches?.name ?? "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {Number(v.distance_from_previous_km) > 0 && (
                      <span>{Number(v.distance_from_previous_km).toFixed(1)} km</span>
                    )}
                    <Clock className="h-3 w-3" />
                    {format(new Date(v.visited_at), "h:mm a")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground leading-tight">
          📍 Location is tracked for travel claims and safety during working hours only.
        </p>
      </CardContent>
    </Card>
  );
};

export default BranchVisitLogger;
