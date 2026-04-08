import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowRightLeft, UserX, UserCheck } from "lucide-react";
import { format } from "date-fns";

interface Props {
  staffId: string;
  staffName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const actionIcons: Record<string, React.ReactNode> = {
  conversion: <ArrowRightLeft className="h-4 w-4 text-primary" />,
  resignation: <UserX className="h-4 w-4 text-destructive" />,
  termination: <UserX className="h-4 w-4 text-destructive" />,
  reactivation: <UserCheck className="h-4 w-4 text-green-500" />,
};

const actionColors: Record<string, string> = {
  conversion: "bg-primary/10 border-primary/30",
  resignation: "bg-destructive/10 border-destructive/30",
  termination: "bg-destructive/10 border-destructive/30",
  reactivation: "bg-green-500/10 border-green-500/30",
};

export default function RoleTimeline({ staffId, staffName, open, onOpenChange }: Props) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["role_history", staffId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_history" as any)
        .select("*")
        .eq("staff_profile_id", staffId)
        .order("effective_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Employment Timeline — {staffName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading history...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No status changes recorded yet.</p>
        ) : (
          <div className="relative space-y-0 py-2">
            {/* Vertical line */}
            <div className="absolute left-[17px] top-4 bottom-4 w-px bg-border" />

            {history.map((h: any, i: number) => (
              <div key={h.id} className="relative flex gap-3 pb-4">
                <div className={`shrink-0 mt-1 w-9 h-9 rounded-full border flex items-center justify-center z-10 bg-background ${actionColors[h.action_type] || ""}`}>
                  {actionIcons[h.action_type] || <ArrowRightLeft className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{h.old_role}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Badge variant="secondary" className="text-xs">{h.new_role}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(h.effective_date), "dd MMM yyyy")}
                    {h.new_rate > 0 && ` · RM ${Number(h.new_rate).toFixed(2)}`}
                  </p>
                  {h.reason && <p className="text-xs mt-1 text-muted-foreground italic">"{h.reason}"</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
